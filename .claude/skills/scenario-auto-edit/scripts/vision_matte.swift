// Person matte + face track for a folder of frames, using Apple Vision (local, free).
// usage: vision_matte <inDir> <outDir> <first> <last> <mode: person|fg|both>
// Writes <outDir>/person/NNNN.png, <outDir>/fg/NNNN.png (8-bit matte at frame size)
// and appends one JSON line per frame to <outDir>/faces.jsonl (normalised, top-left origin).
// prep.py compiles this with swiftc and runs it on a fresh temporary folder per frame range.
import Foundation
import Vision
import CoreImage
import ImageIO
import UniformTypeIdentifiers

let a = CommandLine.arguments
guard a.count == 6, Int(a[3]) != nil, Int(a[4]) != nil, ["person", "fg", "both"].contains(a[5]) else {
    FileHandle.standardError.write("usage: vision_matte <inDir> <outDir> <first> <last> <person|fg|both>\n".data(using: .utf8)!)
    exit(2)
}
let inDir = a[1], outDir = a[2], first = Int(a[3])!, last = Int(a[4])!, mode = a[5]
let fm = FileManager.default
for sub in ["person", "fg"] { try? fm.createDirectory(atPath: "\(outDir)/\(sub)", withIntermediateDirectories: true) }
let ctx = CIContext(options: [.workingColorSpace: NSNull()])
let gray = CGColorSpaceCreateDeviceGray()
let facesURL = URL(fileURLWithPath: "\(outDir)/faces.jsonl")
if !fm.fileExists(atPath: facesURL.path) { fm.createFile(atPath: facesURL.path, contents: nil) }
let faceHandle = try FileHandle(forWritingTo: facesURL); faceHandle.seekToEndOfFile()

func writeMask(_ pb: CVPixelBuffer, w: Int, h: Int, to path: String) {
    var ci = CIImage(cvPixelBuffer: pb)
    let sx = CGFloat(w) / ci.extent.width, sy = CGFloat(h) / ci.extent.height
    ci = ci.applyingFilter("CILanczosScaleTransform", parameters: [kCIInputScaleKey: sy, kCIInputAspectRatioKey: sx / sy])
    ci = ci.cropped(to: CGRect(x: 0, y: 0, width: w, height: h))
    guard let cg = ctx.createCGImage(ci, from: CGRect(x: 0, y: 0, width: w, height: h), format: .L8, colorSpace: gray) else { return }
    let url = URL(fileURLWithPath: path) as CFURL
    let dst = CGImageDestinationCreateWithURL(url, UTType.png.identifier as CFString, 1, nil)!
    CGImageDestinationAddImage(dst, cg, nil); CGImageDestinationFinalize(dst)
}

for i in first...last {
    let name = String(format: "%05d", i)
    let url = URL(fileURLWithPath: "\(inDir)/\(name).jpg")
    guard let src = CGImageSourceCreateWithURL(url as CFURL, nil),
          let img = CGImageSourceCreateImageAtIndex(src, 0, nil) else { continue }
    let w = img.width, h = img.height
    let handler = VNImageRequestHandler(cgImage: img, options: [:])
    var reqs: [VNRequest] = []
    let person = VNGeneratePersonSegmentationRequest(); person.qualityLevel = .accurate
    person.outputPixelFormat = kCVPixelFormatType_OneComponent8
    let fg = VNGenerateForegroundInstanceMaskRequest()
    let face = VNDetectFaceLandmarksRequest()
    if mode == "person" || mode == "both" { reqs.append(person) }
    if mode == "fg" || mode == "both" { reqs.append(fg) }
    reqs.append(face)
    try handler.perform(reqs)
    if let pb = person.results?.first?.pixelBuffer { writeMask(pb, w: w, h: h, to: "\(outDir)/person/\(name).png") }
    if let obs = fg.results?.first, !obs.allInstances.isEmpty {
        if let pb = try? obs.generateScaledMaskForImage(forInstances: obs.allInstances, from: handler) {
            writeMask(pb, w: w, h: h, to: "\(outDir)/fg/\(name).png")
        }
    }
    var rec: [String: Any] = ["i": i]
    if let f = face.results?.max(by: { $0.boundingBox.width < $1.boundingBox.width }) {
        let b = f.boundingBox
        rec["box"] = [b.minX, 1 - b.maxY, b.width, b.height]
        func pts(_ r: VNFaceLandmarkRegion2D?) -> [[Double]] {
            guard let r = r else { return [] }
            return r.normalizedPoints.map { p in [Double(b.minX + p.x * b.width), Double(1 - (b.minY + p.y * b.height))] }
        }
        rec["leye"] = pts(f.landmarks?.leftPupil); rec["reye"] = pts(f.landmarks?.rightPupil)
        rec["nose"] = pts(f.landmarks?.noseCrest); rec["lips"] = pts(f.landmarks?.outerLips)
        if let roll = f.roll { rec["roll"] = roll.doubleValue }
    }
    let data = try JSONSerialization.data(withJSONObject: rec)
    faceHandle.write(data); faceHandle.write("\n".data(using: .utf8)!)
    if i % 50 == 0 { print("frame \(i)") ; fflush(stdout) }
}
faceHandle.closeFile()
