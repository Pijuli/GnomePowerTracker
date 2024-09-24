import Gio from "gi://Gio";
import Adw from "gi://Adw";
import Gtk from "gi://Gtk";

import {
  ExtensionPreferences,
  gettext as _,
} from "resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js";

export default class PowerTrackerPreferences extends ExtensionPreferences {
  // fillPreferencesWindow(window) {
  //   window._settings = this.getSettings();
  //   const page = new Adw.PreferencesPage({
  //     title: _("General"),
  //     icon_name: "dialog-information-symbolic",
  //   });
  //   window.add(page);

  //   const group = new Adw.PreferencesGroup({
  //     title: _("Settings"),
  //     description: _("Configure the extension"),
  //   });
  //   page.add(group);

  //   const refreshRate = new Adw.SpinRow({
  //     title: _("Refresh Rate"),
  //     adjustment: new Gtk.Adjustment({
  //       lower: 1,
  //       upper: 60,
  //       step_increment: 1,
  //       page_increment: 1,
  //       page_size: 0,
  //     }),
  //     value: window._settings.get_int("refreshrate"),
  //   });

  //   group.add(refreshRate);

  //   window._settings.bind(
  //     "refreshrate",
  //     refreshRate,
  //     "value",
  //     Gio.SettingsBindFlags.DEFAULT
  //   );
  // }

  //---------- TUTORIAL EXAMPLE----------
  fillPreferencesWindow(window) {
    // Create a preferences page, with a single group
    const page = new Adw.PreferencesPage({
      title: _("General"),
      icon_name: "dialog-information-symbolic",
    });
    window.add(page);

    const group = new Adw.PreferencesGroup({
      title: _("Appearance"),
      description: _("Configure the appearance of the extension"),
    });
    page.add(group);

    // Create a new preferences row
    const row = new Adw.SwitchRow({
      title: _("Show Indicator"),
      subtitle: _("Whether to show the panel indicator"),
    });
    group.add(row);

    // Create a settings object and bind the row to the `show-indicator` key
    window._settings = this.getSettings();
    window._settings.bind(
      "show-indicator",
      row,
      "active",
      Gio.SettingsBindFlags.DEFAULT
    );
  }
  //---------- TUTORIAL EXAMPLE----------
}
