## GNOME PowerTracker
GNOME PowerTracker is a simple application that helps users monitor their power consumption on GNOME-based systems.

- Does not use any dependencies
- Autodetects any battery that has a representation in /sys/class/power_supply
- You can configure refresh rate and if 0.0W values should be hidden (to avoid screen clutter)

IMPORTANT.
- This will only work with laptops. Afaik there's no simple way to track desktop power consumption
- Power when fully charged is 0W
- Power when charging has a plus sign
- Power when discharging has a minus sign

If you have any issue, please report it so I can take a look at it!
Enjoy!

## Install

### GNOME Extensions Website

This extension is available on [GNOME Extensions Website](https://extensions.gnome.org/extension/7341/power-tracker/).

### Manually

You can download this repo and install it manually with the build script:

```bash
$ ./scripts/build.sh -i
```

*You need gettext package installed on your system*

## Wishlist
- Add some fancy icon (maybe not)
- Add some graphs for better visualization of power usage over time (maybe not)

## Icon attribution
LICENSE: CC Attribution License
AUTHOR: Simon Goetz
