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

import {
  Extension,
  gettext as _,
} from "resource:///org/gnome/shell/extensions/extension.js";
import * as PanelMenu from "resource:///org/gnome/shell/ui/panelMenu.js";

import * as Main from "resource:///org/gnome/shell/ui/main.js";

const PowerTracker = GObject.registerClass(
  class PowerTracker extends PanelMenu.Button {
    _init() {
      this._timeout = null;
      super._init(0.0, _("PowerTracker"));

      this._label = new St.Label({
        text: "? W",
        y_align: Clutter.ActorAlign.CENTER,
      });
      this._get_data();
      this.add_child(this._label);

      this._timeout = GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, 3, () => {
        this._get_data();
        return true;
      });
    }

    _get_data() {
      var raw_power = 0;
      var power_now_exists = GLib.file_test(
        "/sys/class/power_supply/BAT0/power_now",
        GLib.FileTest.EXISTS
      );

      if (power_now_exists) {
        raw_power = this._get_power();
        raw_power = raw_power / 1000000;
      } else {
        var current = this._get_current();
        var voltage = this._get_voltage();
        raw_power = (current * voltage) / 1000000000000;
      }

      var power = (Math.round(raw_power * 100) / 100).toFixed(1);
      var sign = this._get_power_sign();
      this._label.set_text(`${sign}${String(power)} W`);
    }

    _get_power() {
      var filepath = "/sys/class/power_supply/BAT0/power_now";
      let decoder = new TextDecoder();
      try {
        return parseInt(decoder.decode(GLib.file_get_contents(filepath)[1]));
      } catch (e) {
        console.error("Failed to read power: " + e);
      }

      return 0;
    }

    _get_current() {
      var filepath = "/sys/class/power_supply/BAT0/current_now";
      let decoder = new TextDecoder();
      try {
        return parseInt(decoder.decode(GLib.file_get_contents(filepath)[1]));
      } catch (e) {
        console.error("Failed to read current: " + e);
      }

      return 0;
    }

    _get_voltage() {
      var filepath = "/sys/class/power_supply/BAT0/voltage_now";
      let decoder = new TextDecoder();
      try {
        return parseInt(decoder.decode(GLib.file_get_contents(filepath)[1]));
      } catch (e) {
        console.error("Failed to read voltage: " + e);
      }

      return 0;
    }

    _get_power_sign() {
      var filepath = "/sys/class/power_supply/BAT0/status";
      try {
        let decoder = new TextDecoder();
        var status = decoder.decode(GLib.file_get_contents(filepath)[1]).trim();
      } catch (e) {
        console.error("Failed to read status: " + e);
      }
      if (status === "Charging") {
        return "+";
      }
      if (status === "Full") {
        return "";
      }
      return "-";
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
    this._powertracker = new PowerTracker();
    Main.panel.addToStatusArea(this.uuid, this._powertracker);
  }

  disable() {
    this._powertracker.destroy();
    this._powertracker = null;
  }
}
