#!/bin/bash

cd /sys/class/power_supply
while :
do
    for b in BAT[0-9]
    do
        echo "${b}: $(cat ${b}/power_now) $(cat ${b}/status)"
    done
    sleep 3
done