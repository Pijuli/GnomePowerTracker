#!/bin/bash

# Script to build the extension zip and install the package
#
# This Script is released under GPL v3 license
# Copyright (C) 2020-2024 Javad Rahmatzadeh
# Modified by Marc Salat

set -e

echo "Compiling schemas..."
glib-compile-schemas schemas/

echo "Packing extension..."
gnome-extensions pack src \
    --force \
    --podir="../po" \
    --schema="../schemas/org.gnome.shell.extensions.powertracker.gschema.xml" \
    --extra-source="../CHANGELOG.md"

echo "Packing Done!"

while getopts i flag; do
    case $flag in

        i)  gnome-extensions install --force \
            marcs14@gmail.com.shell-extension.zip && \
            echo "Extension is installed. Now restart the GNOME Shell." || \
            { echo "ERROR: Could not install the extension!"; exit 1; };;

        *)  echo "ERROR: Invalid flag!"
            echo "Use '-i' to install the extension to your system."
            echo "To just build it, run the script without any flag."
            exit 1;;
    esac
done

