# Hero Images

Place PNG images of heroes in this folder using the hero ID as the filename.

## Naming Convention

Files should be named using the hero's ID from the `constants.tsx` file, followed by `.png`:

- `freyja.png`
- `trude.png`
- `kyle.png`
- `elysia.png`
- etc.

## Image Requirements

- **Format**: PNG
- **Recommended Size**: 256x256 pixels or higher
- **Aspect Ratio**: Square (1:1)
- **Background**: Transparent or solid background

## Usage

The first 3 heroes in each enemy squad report will display their images if available. If an image is not found or fails to load, the hero name text will be displayed as a fallback.

Hero avatars will be:

- **Top 3 heroes**: 80x80px circular display
- **Other heroes**: 56x56px circular display with text only

## Example Structure

```
public/heroes/
├── README.md
├── freyja.png
├── trude.png
├── kyle.png
├── elysia.png
└── ... (more hero images)
```
