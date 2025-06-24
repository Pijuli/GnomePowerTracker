/* extension.js
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 2 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 *
 * SPDX-License-Identifier: GPL-2.0-or-later
 */

import GObject from "gi://GObject";
import St from "gi://St";
import Clutter from "gi://Clutter";
import GLib from "gi://GLib";
import Gio from "gi://Gio";

import {
  Extension,
  gettext as _,
} from "resource:///org/gnome/shell/extensions/extension.js";
import * as PanelMenu from "resource:///org/gnome/shell/ui/panelMenu.js";

import * as Main from "resource:///org/gnome/shell/ui/main.js";

// CONSTANTS
const BAT_PATH_STUMP = "/sys/class/power_supply/";
const BAT_CLASSES = ["BAT0", "BAT1", "BATT"];
const POWER_NOW_FILE = "/power_now";
const CURRENT_NOW_FILE = "/current_now";
const VOLTAGE_NOW_FILE = "/voltage_now";
const STATUS_FILE = "/status";

const PowerTracker = GObject.registerClass(
  class PowerTracker extends PanelMenu.Button {
    _init(settings) {
      this._settings = settings;

      // -------------
      // CONFIGURATION
      // -------------
      // Settings
      this._settings.bind(
        "refreshrate",
        this,
        "refreshrate",
        Gio.SettingsBindFlags.DEFAULT
      );

      this._settings.connect("changed::refreshrate", (settings, key) => {
        this._set_refresh_rate();
      });

      // -------------

      this._timeout = null;
      super._init(0.0, _("PowerTracker"));

      this._label = new St.Label({
        text: "? W",
        y_align: Clutter.ActorAlign.CENTER,
      });

      this.add_child(this._label);

      this._get_power_data();
      this._set_refresh_rate();
    }

    _set_refresh_rate() {
      if (this._timeout) {
        GLib.Source.remove(this._timeout);
        this._timeout = null;
      }

      this.refreshrate = this._settings.get_int("refreshrate");
      this._timeout = GLib.timeout_add_seconds(
        GLib.PRIORITY_DEFAULT,
        this.refreshrate,
        () => {
          this._get_power_data();
          return true;
        }
      );
    }

    _get_power_data() {
      var outstr = "";
      for (const bat_class of BAT_CLASSES) {
        const bat = BAT_PATH_STUMP + bat_class;
        if (GLib.file_test(bat, GLib.FileTest.IS_DIR)) {
          const powernow = bat + POWER_NOW_FILE;
          const currentnow = bat + CURRENT_NOW_FILE;
          const voltagenow = bat + VOLTAGE_NOW_FILE;
          var sign = "";
          var power = 0.0;
          try {
            var td = new TextDecoder();

            var status = td.decode(GLib.file_get_contents(bat + STATUS_FILE)[1]).trim();
            if (status === "Charging") {
              sign = "+";
            }
            if (status === "Discharging") {
              sign = "-";
            }

            if (GLib.file_test(powernow, GLib.FileTest.EXISTS)) {
              power = (
                parseInt(td.decode(GLib.file_get_contents(powernow)[1])) /
                1000000
              ).toFixed(1);
            } else if (
              GLib.file_test(currentnow, GLib.FileTest.EXISTS) &&
              GLib.file_test(voltagenow, GLib.FileTest.EXISTS)
            ) {
              power = (
                (parseInt(td.decode(GLib.file_get_contents(currentnow)[1])) *
                  parseInt(td.decode(GLib.file_get_contents(voltagenow)[1]))) /
                1000000000000
              ).toFixed(1);
            } else {
              throw new Error(`Couldn't find any power information endpoints!`);
            }

            if (power > 0.0) {
              if (outstr != "") {
                outstr = outstr + ", ";
              }
              outstr = outstr + `${bat_class} ${sign}${String(power)}W`;
            }
          } catch (e) {
            console.error(`Failed to read information for ${bat_class}: ${e}`);
          }
        }
      }

      this._label.set_text(outstr);
      return
    }

    destroy() {
      if (this._timeout) {
        GLib.Source.remove(this._timeout);
        this._timeout = null;
      }
      super.destroy();
    }
  }
);

export default class PowerTrackerExtension extends Extension {
  enable() {
    this._powertracker = new PowerTracker(this.getSettings());
    Main.panel.addToStatusArea(this.uuid, this._powertracker);

    this._powertracker.menu.addAction(_("Preferences"), () =>
      this.openPreferences()
    );
  }

  disable() {
    this._powertracker.destroy();
    this._powertracker = null;
  }
}
