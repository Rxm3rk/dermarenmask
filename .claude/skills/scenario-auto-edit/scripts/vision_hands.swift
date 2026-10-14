// Hand pose track (Apple Vision, local). usage: vision_hands <inDir> <first> <last> <out.jsonl>
// One JSON line per frame: {"i":N,"hands":[{"chir":"left|right","pts":{"wrist":[x,y,c],...}}]}
// Coordinates are normalised with a top-left origin. prep.py compiles this with swiftc and gives it
// a fresh output path inside a temporary folder; it refuses to replace an existing file.
import Foundation
import Vision
import ImageIO

let a = CommandLine.arguments
guard a.count == 5, Int(a[2]) != nil, Int(a[3]) != nil else {
    FileHandle.standardError.write("usage: vision_hands <inDir> <first> <last> <out.jsonl>\n".data(using: .utf8)!)
    exit(2)
}
guard !FileManager.default.fileExists(atPath: a[4]) else {
    FileHandle.standardError.write("\(a[4]) exists; choose a new output path\n".data(using: .utf8)!)
    exit(1)
}
let inDir = a[1], first = Int(a[2])!, last = Int(a[3])!, outPath = a[4]
FileManager.default.createFile(atPath: outPath, contents: nil)
let fh = try FileHandle(forWritingTo: URL(fileURLWithPath: outPath))
let names: [(String, VNHumanHandPoseObservation.JointName)] = [
    ("wrist", .wrist), ("thumbTip", .thumbTip), ("indexMCP", .indexMCP), ("indexTip", .indexTip),
    ("middleMCP", .middleMCP), ("middleTip", .middleTip), ("ringMCP", .ringMCP), ("littleMCP", .littleMCP), ("littleTip", .littleTip)]
for i in first...last {
    let url = URL(fileURLWithPath: String(format: "%@/%05d.jpg", inDir, i))
    guard let src = CGImageSourceCreateWithURL(url as CFURL, nil), let img = CGImageSourceCreateImageAtIndex(src, 0, nil) else { continue }
    let req = VNDetectHumanHandPoseRequest(); req.maximumHandCount = 2
    try VNImageRequestHandler(cgImage: img, options: [:]).perform([req])
    var hands: [[String: Any]] = []
    for obs in req.results ?? [] {
        var pts: [String: [Double]] = [:]
        for (n, j) in names {
            if let p = try? obs.recognizedPoint(j), p.confidence > 0.1 {
                pts[n] = [Double(p.location.x), Double(1 - p.location.y), Double(p.confidence)]
            }
        }
        hands.append(["chir": obs.chirality == .left ? "left" : (obs.chirality == .right ? "right" : "unknown"), "pts": pts])
    }
    let data = try JSONSerialization.data(withJSONObject: ["i": i, "hands": hands])
    fh.write(data); fh.write("\n".data(using: .utf8)!)
}
fh.closeFile()
