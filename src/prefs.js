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

    const showZeroPower = new Adw.SwitchRow({
    title: _('Show 0.0W power'),
      subtitle: _('Show a 0.0W power value instead of hiding it.'),
    });

    group.add(showZeroPower);

    window._settings.bind("showzeropower",showZeroPower,'active',Gio.SettingsBindFlags.DEFAULT);
  }
}
