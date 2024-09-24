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
const BAT0_PATH = "/sys/class/power_supply/BAT0";
const BAT1_PATH = "/sys/class/power_supply/BAT1";
const BATT_PATH = "/sys/class/power_supply/BATT";
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
        this._set_timeout();
      });

      // Paths
      this.REAL_BAT_PATH = BAT0_PATH;
      this.POWER_NOW_EXISTS = false;

      // Check for BAT1 folder exists.
      if (GLib.file_test(BAT1_PATH, GLib.FileTest.IS_DIR)) {
        this.REAL_BAT_PATH = BAT1_PATH;
      }

      // Check for BATT folder exists.
      if (GLib.file_test(BATT_PATH, GLib.FileTest.IS_DIR)) {
        this.REAL_BAT_PATH = BATT_PATH;
      }

      // Check if power_now file exists.
      this.POWER_NOW_EXISTS = GLib.file_test(
        this.REAL_BAT_PATH + POWER_NOW_FILE,
        GLib.FileTest.EXISTS
      );
      // -------------

      this._timeout = null;
      super._init(0.0, _("PowerTracker"));

      this._label = new St.Label({
        text: "? W",
        y_align: Clutter.ActorAlign.CENTER,
      });

      this.add_child(this._label);

      this._get_data();
      this._set_timeout();
    }

    _set_timeout() {
      if (this._timeout) {
        GLib.Source.remove(this._timeout);
        this._timeout = null;
      }

      this.refreshrate = this._settings.get_int("refreshrate");
      this._timeout = GLib.timeout_add_seconds(
        GLib.PRIORITY_DEFAULT,
        this.refreshrate,
        () => {
          this._get_data();
          return true;
        }
      );
    }

    _get_data() {
      var raw_power = 0;

      if (this.POWER_NOW_EXISTS) {
        raw_power = this._get_file_value(POWER_NOW_FILE);
        raw_power = raw_power / 1000000;
      } else {
        var current = this._get_file_value(CURRENT_NOW_FILE);
        var voltage = this._get_file_value(VOLTAGE_NOW_FILE);
        raw_power = (current * voltage) / 1000000000000;
      }

      var power = raw_power.toLocaleString(undefined, {
        minimumFractionDigits: 1,
        maximumFractionDigits: 1,
      });
      var sign = this._get_power_sign();
      this._label.set_text(`${sign}${String(power)} W`);
    }

    _get_file_value(file) {
      let decoder = new TextDecoder();
      try {
        return parseInt(
          decoder.decode(GLib.file_get_contents(this.REAL_BAT_PATH + file)[1])
        );
      } catch (e) {
        console.error("Failed to read file: " + e);
      }

      return 0;
    }

    _get_power_sign() {
      try {
        let decoder = new TextDecoder();
        var status = decoder
          .decode(GLib.file_get_contents(this.REAL_BAT_PATH + STATUS_FILE)[1])
          .trim();
      } catch (e) {
        console.error("Failed to read status: " + e);
      }
      if (status === "Charging") {
        return "+";
      }
      if (status === "Full") {
        return "";
      }
      return "−";
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
