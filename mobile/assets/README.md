# Required Assets for App Store Deployment

You need to create the following asset files for your app:

## Required Images:

1. **icon.png** (1024x1024px)
   - Main app icon in PNG format
   - Should be square with rounded corners will be applied automatically
   - Use your Riddim app logo/branding

2. **adaptive-icon.png** (1024x1024px) 
   - Android adaptive icon foreground
   - Should work well with different background shapes
   - Keep important elements in the center safe zone

3. **splash.png** (1284x2778px recommended)
   - Launch screen image
   - Should match your app's branding
   - Will be centered on screen with backgroundColor from app.json

4. **favicon.png** (32x32px or 16x16px)
   - Web favicon for PWA version
   - Simple, recognizable version of your icon

## Design Guidelines:

- Use your app's primary color scheme (#eab308 yellow/gold theme)
- Keep designs simple and recognizable at small sizes
- Ensure icons work well on both light and dark backgrounds
- Follow Apple Human Interface Guidelines and Material Design principles

## Tools for Creating Icons:

- Figma, Sketch, or Adobe Illustrator for vector-based designs
- Export to PNG at the specified resolutions
- Consider using online tools like AppIcon.co or MakeAppIcon.com

## Next Steps:

1. Create these image files
2. Place them in this assets/ directory
3. Update the EAS project ID in app.json
4. Configure your Apple Developer and Google Play Console accounts
5. Run `eas build --platform ios` and `eas build --platform android`