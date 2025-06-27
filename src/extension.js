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
const POWER_SUPPLY_CLASS_DIR = "/sys/class/power_supply/";
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

export default class PowerTrackerExtension extends Extension {
  show_zero_power;
  refreshrate;
  time_out_id = null;

  enable() {
    console.log("<<<<<<<<<<<<<<<<<<<<<<<<<< PowerTrackerExtension.enable() called >>>>>>>>>>>>>>>>>>>>>>>>>>>>")
    this._indicator = new PanelMenu.Button(0.0, this.metadata.name, false);
    this._indicator._label = new St.Label({
        text: "? W",
        y_align: Clutter.ActorAlign.CENTER,
    });
    this._indicator.add_child(this._indicator._label);

    Main.panel.addToStatusArea(this.uuid, this._indicator);

    this._indicator.menu.addAction(_("Preferences"), () =>
      this.openPreferences()
    );

    this._settings = this.getSettings();
    this.set_refreshrate(this._settings.get_int("refreshrate"));
    this.set_show_zero_power(this._settings.get_boolean("showzeropower"));

    this._settings.connect("changed::refreshrate", (settings, key) => {
      this.set_refreshrate(this._settings.get_int(key));
      console.log(`>>>>>>>>>>> Refreshrate changed to ${String(this.refreshrate)}`);
    });

    this._settings.connect('changed::showzeropower', (settings, key) => {
      this.set_show_zero_power(this._settings.get_boolean(key));
      console.log(`>>>>>>>>>>> Show Zero Power now set to ${String(this.show_zero_power)}`)
    });

    this.update_label();
    console.log(`PowerTrackerExtension initialized with refreshrate=${this.refreshrate} and show_zero_power=${this.show_zero_power}`);
    console.log("<<<<<<<<<<<<<<<<<<<<<<<<<< PowerTrackerExtension.enable() finished >>>>>>>>>>>>>>>>>>>>>>>>>>")
  }

  disable() {
    console.log("<<<<<<<<<<<<<<<<<<<<<<<<<< PowerTrackerExtension.disable() called >>>>>>>>>>>>>>>>>>>>>>>>>>>")
    if (this.time_out_id) {
      GLib.Source.remove(this.time_out_id);
      this.time_out_id = null;
    }
    this._indicator?.destroy();
    this._indicator = null;
    this._settings = null;
    console.log("<<<<<<<<<<<<<<<<<<<<<<<<<< PowerTrackerExtension.disable() finished >>>>>>>>>>>>>>>>>>>>>>>>>")
  }

  get_power_data() {
    console.log("======PowerTracker.get_power_data() called==================");
    // See https://gjs.guide/guides/gio/file-operations.html
    var psClassDirIter;
    try {
      const psClassDir = Gio.File.new_for_path(POWER_SUPPLY_CLASS_DIR);

      psClassDirIter = psClassDir.enumerate_children(
        "standard::*",
        Gio.FileQueryInfoFlags.NOFOLLOW_SYMLINKS,
        null,
      );
    }
    catch(e) {
      console.error(
        `Failed to read information from ${POWER_SUPPLY_CLASS_DIR}: ${e}`,
      );
      this._label.set_text("ERROR");
      return
    }

    var batDirInfo;
    var batCount = 0;
    var batPowerStat = [];
    while (batDirInfo = psClassDirIter.next_file(null)) {
      try {
        const batDir = POWER_SUPPLY_CLASS_DIR + batDirInfo.get_name();
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
    // console.log(batPowerStat);
    console.log("======PowerTracker.get_power_data() finished================");
    return batPowerStat;
  }

  update_label() {
    console.log("<<<<<<<<<<<<<<<<<<<<<<<<<< PowerTrackerExtension.update_label() called >>>>>>>>>>>>>>>>>>>>>>")
    var batPowerStat = this.get_power_data();
    if (batPowerStat.length == 0) {
      this._indicator._label.set_text(NO_BATTERY_LABEL);
    }
    else if (batPowerStat.length == 1) {
      // We only have one battery, we don't need a label before the wattage.
      if (batPowerStat[0].power > 0.0 || this.show_zero_power)
        this._indicator._label.set_text(b.sign+String(batPowerStat[0].power));
      else
        this._indicator._label.set_text(NO_POWER_DRAW_LABEL);
    }
    else {
      // We have more than one battery, we put labels before them.
      var outstr = NO_POWER_DRAW_LABEL;
      for (const b of batPowerStat) {
        // console.log(`Working on ${b.name}`)
        if (b.power > 0.0 || this.show_zero_power) {
          if (outstr != NO_POWER_DRAW_LABEL) {
            outstr = outstr + ", ";
          }
          // For known battery classes we use better labels
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
      console.log(`##### outstr=${outstr}`)
      this._indicator._label.set_text(outstr);
    }
    console.log("<<<<<<<<<<<<<<<<<<<<<<<<<< PowerTrackerExtension.update_label() finished >>>>>>>>>>>>>>>>>>>>")
  }

  set_show_zero_power(show_zero_power) {
    console.log("======PowerTracker.set_show_zero_power() called==================");
    this.show_zero_power = show_zero_power;
    this.update_label();
    console.log(`New setting: show_zero_power=${this.show_zero_power}`)
    console.log("======PowerTracker.set_show_zero_power() finished================");
  }

  set_refreshrate(refreshrate) {
    console.log("======PowerTracker.config_refresh_rate() called==================");
    this.refreshrate = refreshrate;
    console.log(`New setting: refreshrate=${this.refreshrate}`)
    if (this.time_out_id) {
      GLib.Source.remove(this.time_out_id);
      this.time_out_id = null;
    }

    this.time_out_id = GLib.timeout_add_seconds(
      GLib.PRIORITY_DEFAULT,
      refreshrate,
      () => {
        this.update_label();
        return true;
      }
    );
    console.log("======PowerTracker.config_refresh_rate() finished================");
  }
}
