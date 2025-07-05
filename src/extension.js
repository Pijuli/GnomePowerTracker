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
const ZERO_CUTOFF_VALUE = 0.1 // On some hardware there is a minimal amount of power above 0.0W returned although charging has finished, so we use 0.2W for cutoff
const BAT0_LABEL = "Main";
const BAT1_LABEL = "Ext";
const NO_POWER_DRAW_LABEL = "";
const NO_BATTERY_LABEL = "No battery!";

export default class PowerTrackerExtension extends Extension {
  show_zero_power;
  enable_debug_logs = true;
  refreshrate;
  time_out_id = null;

  enable() {
    this.debug_log("<<<<<<<<<<<<<<<<<<<<<<<<<< PowerTrackerExtension.enable() called >>>>>>>>>>>>>>>>>>>>>>>>>>>>")
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
    this.set_enable_debug_logs(this._settings.get_boolean("enabledebuglogs"));

    this._settings.connect("changed::refreshrate", (settings, key) => {
      this.set_refreshrate(this._settings.get_int(key));
      this.debug_log(`>>>>>>>>>>> Refreshrate changed to ${String(this.refreshrate)}`);
    });

    this._settings.connect('changed::showzeropower', (settings, key) => {
      this.set_show_zero_power(this._settings.get_boolean(key));
      this.debug_log(`>>>>>>>>>>> Show Zero Power now set to ${String(this.show_zero_power)}`)
    });

    this._settings.connect('changed::enabledebuglogs', (settings, key) => {
      this.set_enable_debug_logs(this._settings.get_boolean(key));
      this.debug_log(`>>>>>>>>>>> Enable debug_logs now set to ${String(this.enable_debug_logs)}`)
    });

    this.update_label();
    this.debug_log(`PowerTrackerExtension initialized with refreshrate=${this.refreshrate} and show_zero_power=${this.show_zero_power}`);
    this.debug_log("<<<<<<<<<<<<<<<<<<<<<<<<<< PowerTrackerExtension.enable() finished >>>>>>>>>>>>>>>>>>>>>>>>>>")
  }

  disable() {
    this.debug_log("<<<<<<<<<<<<<<<<<<<<<<<<<< PowerTrackerExtension.disable() called >>>>>>>>>>>>>>>>>>>>>>>>>>>")
    if (this.time_out_id) {
      GLib.Source.remove(this.time_out_id);
      this.time_out_id = null;
    }
    this._indicator?.destroy();
    this._indicator = null;
    this._settings = null;
    this.debug_log("<<<<<<<<<<<<<<<<<<<<<<<<<< PowerTrackerExtension.disable() finished >>>>>>>>>>>>>>>>>>>>>>>>>")
  }

  get_power_data() {
    this.debug_log("======PowerTracker.get_power_data() called==================");
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
              var charge_status = td.decode(GLib.file_get_contents(typefile)[1]).trim();
              if (charge_status != "Battery") {
                continue;
              }
            }
            else {
              continue;
            }

            var power = 0.0;
            if (GLib.file_test(powernow, GLib.FileTest.EXISTS)) {
              // On some implementations the returned values are negative when discharging.
              // This leads to two minus signs. We take the absolute value here to avoid this.
              power = Math.abs(
                parseInt(td.decode(GLib.file_get_contents(powernow)[1])) /
                1000000
              ).toFixed(DECIMAL_PLACES_POWER_VAL);
              this.debug_log(`###### ${powernow} = ${power}`)
            } else if (
              GLib.file_test(currentnow, GLib.FileTest.EXISTS) &&
              GLib.file_test(voltagenow, GLib.FileTest.EXISTS)
            ) {
              currentnow_val = parseInt(td.decode(GLib.file_get_contents(currentnow)[1]));
              voltagenow_val = parseInt(td.decode(GLib.file_get_contents(voltagenow)[1]));
              // On some implementations the returned values are negative when discharging.
              // This leads to two minus signs. We take the absolute value here to avoid this.
              power = Math.abs((currentnow_val * voltagenow_val) / 1000000000000).toFixed(DECIMAL_PLACES_POWER_VAL);
              this.debug_log(`###### ${currentnow} = ${currentnow_val}`)
              this.debug_log(`###### ${voltagenow} = ${voltagenow_val}`)
              this.debug_log(`###### ${powernow} = ${power}`)
            } else {
              continue;
            }
            batCount++;

            var sign = "";
            if (GLib.file_test(statusfile, GLib.FileTest.EXISTS)) {
              var charge_status = td.decode(GLib.file_get_contents(statusfile)[1]).trim();
              if (charge_status === "Charging") {
                sign = "+";
              }
              if (charge_status === "Discharging") {
                sign = "-";
              }
              this.debug_log(`###### ${statusfile} = ${charge_status}`)
            }
            batPowerStat.push({"name":batDirInfo.get_name(), "sign": sign, "power":power})
        }
      } catch (e) {
        console.error(
          `Failed to read information for ${batDirInfo.get_name()}: ${e}`,
        );
      }
    }
    this.debug_log("###### batPowerStat = ",batPowerStat);
    this.debug_log("======PowerTracker.get_power_data() finished================");
    return batPowerStat;
  }

  update_label() {
    this.debug_log("<<<<<<<<<<<<<<<<<<<<<<<<<< PowerTrackerExtension.update_label() called >>>>>>>>>>>>>>>>>>>>>>")
    var batPowerStat = this.get_power_data();
    if (batPowerStat.length == 0) {
      this._indicator._label.set_text(NO_BATTERY_LABEL);
    }
    else if (batPowerStat.length == 1) {
      // We only have one battery, we don't need a label before the wattage.
      if (batPowerStat[0].power > ZERO_CUTOFF_VALUE || this.show_zero_power)
        this._indicator._label.set_text(b.sign+String(batPowerStat[0].power));
      else
        this._indicator._label.set_text(NO_POWER_DRAW_LABEL);
    }
    else {
      // We have more than one battery, we put labels before them.
      var outstr = NO_POWER_DRAW_LABEL;
      for (const b of batPowerStat) {
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
      this.debug_log(`###### outstr=${outstr}`)
      this._indicator._label.set_text(outstr);
    }
    this.debug_log("<<<<<<<<<<<<<<<<<<<<<<<<<< PowerTrackerExtension.update_label() finished >>>>>>>>>>>>>>>>>>>>")
  }

  set_show_zero_power(show_zero_power) {
    this.debug_log("======PowerTracker.set_show_zero_power() called==================");
    this.show_zero_power = show_zero_power;
    this.update_label();
    this.debug_log(`New setting: show_zero_power=${this.show_zero_power}`)
    this.debug_log("======PowerTracker.set_show_zero_power() finished================");
  }

  set_enable_debug_logs(enable_debug_logs) {
    this.enable_debug_logs = enable_debug_logs;
    console.log(`New setting: enable_debug_logs=${this.enable_debug_logs}`)
  }

  set_refreshrate(refreshrate) {
    this.debug_log("======PowerTracker.config_refresh_rate() called==================");
    this.refreshrate = refreshrate;
    this.debug_log(`New setting: refreshrate=${this.refreshrate}`)
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
    this.debug_log("======PowerTracker.config_refresh_rate() finished================");
  }

  debug_log(...str) {
    if (this.enable_debug_logs)
      console.log(...str);
  }
}
