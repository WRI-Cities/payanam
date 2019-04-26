'''
Combined App
start date: 1.1.19
author: Nikhil VJ
Created for work on TSRTC Hyderabad bus routes
'''

print('\nPayanam')
print('Starting up the program, loading dependencies, please wait...\n\n')

import datetime
import json, xmltodict
import os, sys, webbrowser, signal # signal: for catching Ctrl+C and exiting gracefully.
import shutil # for copying etc
import time, datetime
from collections import OrderedDict
from math import sin, cos, sqrt, atan2, radians

import pandas as pd
import tornado.ioloop, tornado.web

# for fuzzy search
import jellyfish as jf
# from fuzzywuzzy import fuzz 

# setting constants
root = os.path.dirname(__file__) # needed for tornado and all other paths, prog should work even if called from other working directory.
startPage = 'index.html' # change the starting page as per needs.

routesFolder = os.path.join(root,'routes')
lockFolder = os.path.join(root,'locked-routes')
timeFolder = os.path.join(root,'timings')
logFolder = os.path.join(root,'logs')
configFolder = os.path.join(root,'config')
reportsFolder = os.path.join(root,'reports')
databankFolder = os.path.join(root,'databank')
backupsFolder = os.path.join(root,'backups')
# uploadFolder = os.path.join(root,'uploads')
# exportFolder = os.path.join(root,'export') # 4.9.18 putting exports here now
# dataCleaningFolder = os.path.join(root,'datacleaning')

configFile = 'config.json'
accessFile = 'access.csv'
accessRanking = ["VIEW","MAPPER","DATAENTRY","REVIEW","ADMIN"]

# paths were you must not tread.. see "MyStaticFileHandler" class in apy.py
forbiddenPaths = []
forbiddenEndings = ['.py','access.csv']
debugMode = False # using this flag at various places to do or not do things based on whether we're in development or production

try:
    configRules = json.load(open(os.path.join(configFolder,configFile)))
except FileNotFoundError:
    configRules = {}

# create folders if they don't exist
for folder in [routesFolder, lockFolder, logFolder, configFolder, reportsFolder, databankFolder, backupsFolder]:
    os.makedirs(folder, exist_ok=True)

exec(open(os.path.join(root,"functions.py"), encoding='utf8').read())
exec(open(os.path.join(root,"api.py"), encoding='utf8').read())

logmessage('Loaded dependencies, starting program.')

def make_app():
    return tornado.web.Application([
        (r"/API/loadJsonsList", loadJsonsList),
        (r"/API/loadJson", loadJson),
        (r"/API/GPXUpload", GPXUpload),
        (r"/API/routeSuggest", routeSuggest),
        (r"/API/routeLock", routeLock),
        (r"/API/bulkSuggest", bulkSuggest),
        (r"/API/keyCheck", keyCheck),
        (r"/API/catchJumpers", catchJumpers),
        (r"/API/routeEntry", routeEntry),
        (r"/API/reconcile", reconcile),
        (r"/API/getRouteLine", getRouteLine),
        (r"/API/removeAutoMappingAPI", removeAutoMappingAPI),
        (r"/API/timings", timings),
        (r"/API/unLock", unLock),
        #(r"/API/allStops", allStops),
        # (r"/(.*)", tornado.web.StaticFileHandler, {"path": root, "default_filename": startPage})
        (r"/(.*)", MyStaticFileHandler, {"path": root, "default_filename": startPage})
    ])
# note: using 1.html as homepage here.


# for catching Ctrl+C and exiting gracefully. From https://nattster.wordpress.com/2013/06/05/catch-kill-signal-in-python/
def signal_term_handler(signal, frame):
    # to do: Make this work in windows, ra!
    logmessage('\nClosing Program.\nThank you for using this program. Feedback : nikhil.js [at] gmail.com')
    sys.exit(0)

if __name__ == "__main__":
    signal.signal(signal.SIGINT, signal_term_handler)
    app = make_app()
    portnum = 5050
    while True: # loop to increment the port number till we find one that isn't occupied
        try:
            port = int(os.environ.get("PORT", portnum))
            app.listen(port)
            break
        except OSError:
            portnum += 1
            if portnum > 9999: 
                logmessage('Can\'t launch as no port number from 5000 through 9999 is free.')
                sys.exit()

    thisURL = "http://localhost:" + str(port)
    webbrowser.open(thisURL)
    logmessage("\n\nOpen {} in your Web Browser if you don't see it opening automatically in 5 seconds.\n\nNote: If this is through docker, then it's not going to auto-open in browser, don't wait.".format(thisURL))
    tornado.ioloop.IOLoop.current().start()
