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
const POWER_SUPPLY_DIR = "/sys/class/power_supply/";
const TYPE_FILE = "/type"
const POWER_NOW_FILE = "/power_now";
const CURRENT_NOW_FILE = "/current_now";
const VOLTAGE_NOW_FILE = "/voltage_now";
const STATUS_FILE = "/status";
const DECIMAL_PLACES_POWER_VAL = 1;
const BAT0_LABEL = "Main";
const BAT1_LABEL = "Ext";
const NO_POWER_DRAW_LABEL = "";
const NO_BATTERY_LABEL = "No battery!";

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
      // See https://gjs.guide/guides/gio/file-operations.html
      var psDirIter;
      try {
        const powerSupplyDir = Gio.File.new_for_path(POWER_SUPPLY_DIR);

        psDirIter = powerSupplyDir.enumerate_children(
          "standard::*",
          Gio.FileQueryInfoFlags.NOFOLLOW_SYMLINKS,
          null,
        );
      }
      catch(e) {
        console.error(
          `Failed to read information from ${POWER_SUPPLY_DIR}: ${e}`,
        );
        this._label.set_text("ERROR");
        return
      }

      var batDirInfo;
      var batCount = 0;
      var batPowerStat = [];
      while (batDirInfo = psDirIter.next_file(null)) {
        try {
          const batDir = POWER_SUPPLY_DIR + batDirInfo.get_name();
          if (GLib.file_test(batDir, GLib.FileTest.IS_DIR)) {
            const powernow = batDir + POWER_NOW_FILE;
            const currentnow = batDir + CURRENT_NOW_FILE;
            const voltagenow = batDir + VOLTAGE_NOW_FILE;
            const statusfile = batDir + STATUS_FILE;
            const typefile = batDir + TYPE_FILE;
              var td = new TextDecoder();

              if (GLib.file_test(typefile, GLib.FileTest.EXISTS)) {
                var pstype = td.decode(GLib.file_get_contents(typefile)[1]).trim();
                if (pstype != "Battery") {
                  continue;
                }
              }
              else {
                continue;
              }

              var power = 0.0;
              if (GLib.file_test(powernow, GLib.FileTest.EXISTS)) {
                power = (
                  parseInt(td.decode(GLib.file_get_contents(powernow)[1])) /
                  1000000
                ).toFixed(DECIMAL_PLACES_POWER_VAL);
              } else if (
                GLib.file_test(currentnow, GLib.FileTest.EXISTS) &&
                GLib.file_test(voltagenow, GLib.FileTest.EXISTS)
              ) {
                power = (
                  (parseInt(td.decode(GLib.file_get_contents(currentnow)[1])) *
                    parseInt(td.decode(GLib.file_get_contents(voltagenow)[1]))) /
                  1000000000000
                ).toFixed(DECIMAL_PLACES_POWER_VAL);
              } else {
                continue;
              }
              batCount++;

              var sign = "";
              if (GLib.file_test(statusfile, GLib.FileTest.EXISTS)) {
                var pstype = td.decode(GLib.file_get_contents(statusfile)[1]).trim();
                if (pstype === "Charging") {
                  sign = "+";
                }
                if (pstype === "Discharging") {
                  sign = "-";
                }
              }
              batPowerStat.push({"name":batDirInfo.get_name(), "sign": sign, "power":power})
          }
        } catch (e) {
          console.error(
            `Failed to read information for ${batDirInfo.get_name()}: ${e}`,
          );
        }
      }
      // console.log("=============================================================");
      // console.log(batPowerStat);
      
      if (batPowerStat.length == 0) {
        this._label.set_text(NO_BATTERY_LABEL);
      }
      else if (batPowerStat.length == 1) {
        // We only have one battery, we don't need a label before the wattage.
        if (batPowerStat[0].power > 0.0)
          this._label.set_text(b.sign+String(batPowerStat[0].power));
        else
          this._label.set_text(NO_POWER_DRAW_LABEL);
      }
      else {
        // We have more than one battery, we put labels before them.
        var outstr = "";
        for (const b of batPowerStat) {
          console.log(`Working ${b.name}`)
          if (b.power > 0.0) {
            if (outstr != "") {
              outstr = outstr + ", ";
            }
            // For known battery classes we put better labels
            var labelname;
            if (b.name === "BAT0") {
              labelname = BAT0_LABEL;
            }
            else if (b.name === "BAT1") {
              labelname = BAT1_LABEL;
            }
            else {
              labelname = b.name;
            }
            outstr = outstr + `${labelname} ${b.sign}${String(b.power)}W`;
          }
        }
        this._label.set_text(outstr);
      }
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
