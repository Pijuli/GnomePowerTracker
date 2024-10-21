import Gio from "gi://Gio";
import Adw from "gi://Adw";
import Gtk from "gi://Gtk";

import {
  ExtensionPreferences,
  gettext as _,
} from "resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js";

export default class PowerTrackerPreferences extends ExtensionPreferences {
  fillPreferencesWindow(window) {
    window._settings = this.getSettings();
    const page = new Adw.PreferencesPage({
      title: _("General"),
      icon_name: "dialog-information-symbolic",
    });
    window.add(page);

    const group = new Adw.PreferencesGroup({
      title: _("Preferences"),
    });
    page.add(group);

    const refreshRate = new Adw.SpinRow({
      title: _("Refresh Rate"),
      adjustment: new Gtk.Adjustment({
        lower: 1,
        upper: 60,
        step_increment: 1,
        page_increment: 1,
        page_size: 0,
      }),
      value: window._settings.get_int("refreshrate"),
    });

    group.add(refreshRate);

    window._settings.bind(
      "refreshrate",
      refreshRate,
      "value",
      Gio.SettingsBindFlags.DEFAULT
    );

    const panelOrder = new Adw.SpinRow({
      title: _("Panel Order"),
      adjustment: new Gtk.Adjustment({
        lower: -10,
        upper: 20,
        step_increment: 1,
        page_increment: 1,
        page_size: 0,
      }),
      value: window._settings.get_int("panelorder"),
    });

    group.add(panelOrder);

    window._settings.bind(
      "panelorder",
      panelOrder,
      "value",
      Gio.SettingsBindFlags.DEFAULT
    );
  }
}
