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
const BAT_PATH_STUMP = "/sys/class/power_supply/BAT";
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
      var _outstring = ''
      for (var i = 0; i < 10; i++) {
        var _bat = BAT_PATH_STUMP + i
        if (GLib.file_test(_bat, GLib.FileTest.IS_DIR)) {
          var _powernow = _bat + POWER_NOW_FILE
          var _sign = '-'
          var _power = 0
          if (GLib.file_test(_powernow, GLib.FileTest.EXISTS)) {
            try {
              let decoder = new TextDecoder();
              var status = decoder
                .decode(GLib.file_get_contents(_bat +  STATUS_FILE)[1])
                .trim();
              if (status === "Charging") {
                _sign = "+";
              }
              if (status === "Full") {
                _sign = "";
              }
              _power = parseInt(
                decoder.decode(GLib.file_get_contents(_powernow)[1])
              ) / 1000000;
              _outstring = _outstring +`${String(i)}: ${_sign}${String(_power)} W `
            } catch (e) {
              console.error("Failed to read status: " + e);
            }
          }
        }
        else
        {
          break
        }
        this._label.set_text(_outstring);
      }
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
