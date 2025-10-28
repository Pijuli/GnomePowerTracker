## v0.5 2025-10-28
- Fixed Catalan and Spanish translation.
- Use load_contents_async for the power files
- Add Gnome 49 support

## v0.4 2025-06-26
- Changed detection algorithm. Now all batteries in /sys/class/power_supply should be detected.
- Added support for multiple batteries in the same laptop.
- Added setting to optionally hide the display of 0W values.
    - Note: Spanish and Catalan translations are still missing for the new setting.

## v0.3 2024-09-22
- Localize the power draw to the current locale.
- Detect BAT0/BAT1/BATT folder

## v0.2 2024-09-21
- Use power_now if available, otherwise use current_now and voltage_now to calculate the power draw.

## v0.1 2024-09-17
- First release of the project.
