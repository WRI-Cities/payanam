#!/bin/bash
# gtfs_payanam.sh
# 11.4.19 Payanam gtfs creation + validation script

# have to put this in crontab to run every 2 hours

/usr/bin/python3 /root/payanam/gtfs_creation.py >> /root/cron_payanam.log

/usr/bin/python2 /root/gtfs_feeds/transitfeed/feedvalidator.py -n -d -l 1000 -o "/root/payanam/reports/gtfs_validation_report.html" "/root/payanam/gtfs/"
