# Set pieces for the big moment

`film.py` covers the standard moves. For the one moment that has to make people stop scrolling (usually "you can
do everything", "here is what it makes", "and then this happened"), build a set piece. These three were built
for the same hook; pick the one that fits the line. Each owns a time window and hands back to the base edit.

## 1. One idea, every medium (match-cut B-roll montage)

The speaker's voice continues over full-screen B-roll of one IP in every medium (sketch, clay 3D, textured 3D,
key art, animation, anime, pixel art, gameplay, poster), cut on the music grid: 8th notes first so the eye can
read, then 16ths, then a 1 and 2 frame strobe into the drop.

- Lock the subject: scale and position every shot so the character's body centre and height are identical on screen (Apple Vision foreground masks give the boxes). The cuts then feel like one object changing medium.
- Enter with a match cut on the eyes: push into the speaker's eyes, cut to the character's eyes.
- Each shot gets its own gentle forward push. Pixel art scales nearest-neighbour.
- One plain typeset label per shot (SKETCH, 3D CLAY, KEY ART...) and a small running count. No chips.
- A white flash on the drop hides the hand-back.

## 2. The canvas (product-film UI)

The frame pulls back: the speaker becomes a card on an infinite warm off-white canvas, and real asset cards land
around them on 16th notes (spring scale, rise, shadow growing as it lands): images, a spinning turntable, a
playing clip, a live waveform of the actual music. The camera drifts in one monotone move. On the build, every
card flies to the centre, morphs into a diamond (interpolate its four corners) and the stack becomes the brand
mark exactly on the drop, while their card scales back to full frame.

- Cards: rounded corners, hairline inner border, layered shadow, a small plain label underneath. No toolbars, buttons or menus: the content is the UI.
- Hand off to the logo in the base edit at the same position, size and colour so nothing animates twice.

## 3. Hologram in the hands (tracked AR)

Apple Vision tracks the hands (`prep/hands.jsonl`). As the speaker opens their hands, a projection grows between
the palms, sized to their distance, and cycles through the mediums on 16th notes; it lifts off as the hands
drop, rises past the face, and bursts into the brand mark above the head on the drop.

- Sell it with light, not with the panel: additive blend, fine scanlines, a soft edge, a faint chromatic fringe, a flicker on each switch, a light cone from the palms, and warm light falling on the hands, shirt and face through the matte, plus a rim on the hand edges facing it.
- Smooth the track (it must never jitter); fade the hologram by track confidence.

## Hand-back rules for any set piece

- Own a clear window; motion-blur samples never cross its edges.
- Mute the base edit's effect cues inside the window and add your own, under the voice.
- If the base edit animates a logo right after your window, extend your window to cover that build and leave the logo exactly where and how the base expects it.
