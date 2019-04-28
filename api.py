'''
api.py

All API calls defined here.

# Tornado API functions template:
class APIHandler(tornado.web.RequestHandler):
    def get(self):
        #get the Argument that User had passed as name in the get request
        userInput=self.get_argument('name')
        welcomeString=sayHello(userInput)
        #return this as JSON
        self.write(json.dumps(welcomeString))

    def post(self):
        user = self.get_argument("username")
        passwd = self.get_argument("password")
        time.sleep(10)
        self.write("Your username is %s and password is %s" % (user, passwd))
'''

class loadJsonsList(tornado.web.RequestHandler):
    def get(self):
        # /API/loadJsonsList optional parameter: [?which=locked]
        start = time.time()
        which = self.get_argument('which',default='')

        if which != 'locked':
            returnContent = recursiveDropdown(routesFolder,ext='.json')
        else:
            returnContent = recursiveDropdown(lockFolder,ext='.json')

        self.write(returnContent)
        end = time.time()
        logmessage("loadJsonsList GET call took {} seconds.".format(round(end-start,2)))

class loadJson(tornado.web.RequestHandler):
    def get(self):
        # /API/loadJson?route=filename
        start = time.time()
        filename = self.get_argument('route',default='')
        logmessage(filename)
        if not filename or not os.path.exists(os.path.join(routesFolder,filename)):
            self.set_status(400)
            self.write("Error: invalid filename.")
            return
        
        with open(os.path.join(routesFolder,filename)) as fh:
            a = json.load(fh)
        self.write(json.dumps(a) )
        end = time.time()
        logmessage("loadJson GET call took {} seconds.".format(round(end-start,2)))

    def post(self):
        # /API/loadJson?route=filename&key=key
        start = time.time()

        key = self.get_argument('key',default='')
        if not checkAccess(key,'MAPPER'):
            self.set_status(400)
            self.write("Error: Need Mapper level API Key.")
            return
       
        filename = self.get_argument('route',default='')
        data = json.loads( self.request.body.decode('UTF-8'), object_pairs_hook=OrderedDict )
        logmessage(filename)

        saveStatus = saveRoute(filename,data, key=key)
        self.write(saveStatus)
        end = time.time()
        logmessage("loadJson POST call (to save a route) took {} seconds.".format(round(end-start,2)))


class GPXUpload(tornado.web.RequestHandler):
    def post(self):
        # /API/GPXUpload
        start = time.time()

        gpx_string = self.request.files['gpx'][0]['body']
        gpxDict = xmltodict.parse(gpx_string, attr_prefix='')
        
        waypointDF1 = pd.DataFrame(gpxDict['gpx']['wpt'])
        # waypointDF2 = waypointDF1[waypointDF1.name.str.lower() != 'bus stop'][['name','lat','lon','time']].copy()
        waypointDF2 = waypointDF1[['name','lat','lon','time']].copy()
        # removing extra bus stop entries
        waypointDict = waypointDF2.to_dict(orient='records', into=OrderedDict)
        
        trackDict = [ [ x['lat'], x['lon'] ] for x in gpxDict['gpx']['trk']['trkseg']['trkpt'] ]

        returnJson = json.dumps({'waypoint':waypointDict, 'track':trackDict}, ensure_ascii=False)
        self.write(returnJson)
        end = time.time()
        logmessage("GPXUpload POST call took {} seconds.".format(round(end-start,2)))


class routeSuggest(tornado.web.RequestHandler):
    def get(self):
        # /API/routeSuggest?route=filename&fuzzy=fuzzy&key=key
        start = time.time()

        filename = self.get_argument('route',default='')
        if not len(filename):
            self.set_status(400)
            self.write("Error: Load a valid route.")
            return
        
        key = self.get_argument('key',default='')
        if not checkAccess(key,'MAPPER'):
            self.set_status(400)
            self.write("Error: Need Mapper level API Key.")
            return
        
        fuzzy = ( self.get_argument('fuzzy',default='n') == 'y' )

        # logmessage('routeSuggest:',filename)
        status = routeSuggestFunc(filename=filename, fuzzy=fuzzy, suggestManual=True, mapAgain=True, key=key)
        self.write(status)
        end = time.time()
        logmessage("routeSuggest GET call took {} seconds.".format(round(end-start,2)))

class routeLock(tornado.web.RequestHandler):
    def get(self):
        # /API/routeLock?route=filename
        start = time.time()
        
        key = self.get_argument('key',default='')
        if not checkAccess(key,'REVIEW'):
            self.set_status(400)
            self.write("Error: Need Reviewer level API Key.")
            return

        filename = self.get_argument('route',default='')
        if not len(filename):
            self.set_status(400)
            self.write("Error: Load a valid route.")
            return
        
        logmessage('routeLock:',filename)
        status = routeLockFunc(filename,key=key)
        self.write(status)
        end = time.time()
        logmessage("routeLock GET call took {} seconds.".format(round(end-start,2)))

class bulkSuggest(tornado.web.RequestHandler):
    def get(self):
        # /API/bulkSuggest?mapFirst=${mapFirst}&suggestManual=${suggestManual}&mapAgain=${mapAgain}&jumpers=${jumpers}&key=${globalApiKey}
        start = time.time()

        key = self.get_argument('key',default='')
        if not checkAccess(key,'ADMIN'):
            self.set_status(400)
            self.write("Error: Need Admin level API Key.")
            return

        mapFirst = ( self.get_argument('mapFirst',default='n') == 'y' )
        suggestManual = ( self.get_argument('suggestManual',default='n') == 'y' )
        mapAgain = ( self.get_argument('mapAgain',default='n') == 'y' )
        fuzzy = ( self.get_argument('fuzzy',default='n') == 'y' )
        jumpers = ( self.get_argument('jumpers',default='n') == 'y' )
        dryRun = not ( self.get_argument('dryRun',default='y') == 'n' )
        # skipEmpty = ( self.get_argument('skipEmpty',default='n') == 'y' )


        logmessage('Beginning bulkSuggest function. This may take long.')
        logmessage('mapFirst:',mapFirst)
        logmessage('suggestManual:',suggestManual)
        logmessage('mapAgain:',mapAgain)
        logmessage('fuzzy:',fuzzy)
        logmessage('jumpers:',jumpers)
        logmessage('dryRun (for removing jumpers):',dryRun)
        # logmessage('skipEmpty:',skipEmpty)
        
        routesList = getallRoutes()

        dfMapped=loadMappedStops()
        dfDataBank=loadDataBank()

        returnMessages = []
        for filename in routesList:

            if filename.endswith('unmapped.json'): continue # want to skip bulk-mapping for this one.
            
            status = routeSuggestFunc(filename=filename, dfMapped=dfMapped, dfDataBank=dfDataBank, mapFirst=mapFirst, suggestManual=suggestManual, mapAgain=mapAgain, fuzzy=fuzzy, key=key)
            returnMessages.append( status )

            if jumpers:
                status = sanityFunc(filename,key=key,dryRun=dryRun)
                returnMessages.append( status )

        logmessage('\n'.join(returnMessages))
        self.write('<br>'.join(returnMessages))
        end = time.time()
        logmessage("bulkSuggest GET call took {} seconds.".format(round(end-start,2)))

class keyCheck(tornado.web.RequestHandler):
    def get(self):
        # /API/keyCheck?key=${globalApiKey}
        start = time.time()

        key = self.get_argument('key',default='')
        returnData = userInfo(key)

        if not returnData:
            self.set_status(400)
            self.write("Error: Invalid API Key.")
            return
       
        self.write(json.dumps(returnData))
        end = time.time()
        logmessage("keyCheck GET call took {} seconds.".format(round(end-start,2)))

class catchJumpers(tornado.web.RequestHandler):
    def get(self):
        # /API/catchJumpers?route=filename&key=${globalApiKey}&dryRun=n
        start = time.time()

        key = self.get_argument('key',default='')
        if not checkAccess(key,'ADMIN'):
            self.set_status(400)
            self.write("Error: Need Admin level API Key.")
            return

        route = self.get_argument('route',default='')
        if not route:
            self.set_status(400)
            self.write("Error: Need valid route.")
            return
        
        dryRun = not ( self.get_argument('dryRun',default='y') == 'n' )

        returnMessage = sanityFunc(route,key,dryRun)

        self.write(returnMessage)
        end = time.time()
        logmessage("catchJumpers GET call for route {} took {} seconds.".format(route,round(end-start,2)))

class routeEntry(tornado.web.RequestHandler):
    def post(self):
        # /API/GPXUpload
        start = time.time()
        key = self.get_argument('key',default='')
        if not checkAccess(key,'DATAENTRY'):
            self.set_status(400)
            self.write("Error: Need DATAENTRY level API Key.")
            return

        route = self.get_argument('route',default='')
        if not route:
            self.set_status(400)
            self.write("Error: Need valid route.")
            return
        
        data = json.loads( self.request.body.decode('UTF-8'), object_pairs_hook=OrderedDict )

        logmessage('routeEntry save:',route)
        returnMessage = saveDataEntryRoute(route,data,key)

        self.write(returnMessage)
        end = time.time()
        logmessage("routeEntry POST call for route {} took {} seconds.".format(route,round(end-start,2)))

class reconcile(tornado.web.RequestHandler):
    def post(self):
        # /API/reconcile?key=${globalApiKey}
        start = time.time()
        key = self.get_argument('key',default='')
        if not checkAccess(key,'ADMIN'):
            self.set_status(400)
            self.write("Error: Need ADMIN level API Key.")
            return
        data = json.loads( self.request.body.decode('UTF-8'), object_pairs_hook=OrderedDict )
        
        logmessage(json.dumps(data,indent=2))

        returnList = []
        recon_stop_name = data.get('recon_stop_name')
        recon_stop_desc = data.get('recon_stop_desc')
        recon_stop_lat = data.get('recon_stop_lat')
        recon_stop_lon = data.get('recon_stop_lon')
        for stopDetail in data.get('stops',[]):
            folder = stopDetail.get('folder')
            jsonFile = stopDetail.get('jsonFile')
            direction_id = stopDetail.get('direction_id')
            searchName = stopDetail.get('stop_name')

            if stopDetail.get('workStatus') == 'working':
                status= changeStop(key,folder,jsonFile,direction_id,searchName,recon_stop_name,recon_stop_desc,recon_stop_lat,recon_stop_lon)
            else:
                status = "{}/{} is locked so no changes there.".format(folder,jsonFile)
            returnList.append(status)
        
        self.write('<br>'.join(returnList) )
        end = time.time()
        logmessage("reconcile POST call took {} seconds.".format(round(end-start,2)))
        comment = ''' # this is what a standard json object received in this API call looks like:
        {
            "recon_stop_name": "Basheer Bagh",
            "recon_stop_desc": "",
            "recon_stop_lat": 17.4018,
            "recon_stop_lon": 78.47571,
            "stops": [
                {
                    "sr": "247",
                    "workStatus": "working",
                    "folder": "KCG",
                    "jsonFile": "136H.json",
                    "depot": "KCG",
                    "routeName": "136H",
                    "direction_id": "0",
                    "stop_sequence": "23",
                    "stop_name": "Basheer Bagh",
                    "stop_lat": "17.4018",
                    "stop_lon": "78.47571",
                    "zap": "basheerbagh",
                    "confidence": "1",
                    "stop_desc": ""
                },
                {
                    "sr": "255",
                    "workStatus": "working",
                    "folder": "KCG",
                    "jsonFile": "136H.json",
                    "depot": "KCG",
                    "routeName": "136H",
                    "direction_id": "1",
                    "stop_sequence": "4",
                    "stop_name": "Basheer Bagh",
                    "stop_lat": "17.4018",
                    "stop_lon": "78.47571",
                    "zap": "basheerbagh",
                    "confidence": "1",
                    "stop_desc": ""
                }
            ]
        }
        '''

class getRouteLine(tornado.web.RequestHandler):
    def get(self):
        # /API/getRouteLine?folder=folder&jsonFile=jsonFile&direction_id=direction_id
        start = time.time()

        folder = self.get_argument('folder',default='')
        jsonFile = self.get_argument('jsonFile',default='')
        direction_id = str(self.get_argument('direction_id',default=''))

        if not (folder and jsonFile):
            self.set_status(400)
            self.write("Error: Need valid route.")
            return

        returnContent = routeLine(folder,jsonFile,direction_id) # get an array of lat-longs like [[1,2],[1,3]]
        self.write(json.dumps(returnContent)) # send it in json format
        end = time.time()
        logmessage("getRouteLine GET call for {}/{}:{} took {} seconds.".format(folder,jsonFile,direction_id,round(end-start,2)))


class removeAutoMappingAPI(tornado.web.RequestHandler):
    def get(self):
        # /API/removeAutoMappingAPI?really=${removeReally}&deSuggest=${removeSuggestions}&key=${globalApiKey}
        start = time.time()

        key = self.get_argument('key',default='')
        if not checkAccess(key,'ADMIN'):
            self.set_status(400)
            self.write("Error: Need ADMIN level API Key.")
            return
        
        really = self.get_argument('really',default='n') == 'y'
        deSuggest = self.get_argument('deSuggest',default='n') == 'y'

        returnList = removeAutoMapping(key,really,deSuggest)
        self.write('<br>'.join(returnList) )
        end = time.time()
        logmessage("removeAutoMappingAPI GET call took {} seconds.".format(round(end-start,2)))

class timings(tornado.web.RequestHandler):
    def post(self):
        # /API/timings?key=${globalApiKey}&route=${globalRoute}
        start = time.time()
        key = self.get_argument('key',default='')
        if not checkAccess(key,'MAPPER'):
            self.set_status(400)
            self.write("Error: Need MAPPER level API Key.")
            return
        
        route = self.get_argument('route',default='')
        if not route:
            self.set_status(400)
            self.write("Error: Need valid route.")
            return

        data = json.loads( self.request.body.decode('UTF-8'), object_pairs_hook=OrderedDict )
        
        returnStatus = storeTimings(route,data,key)
        logmessage(returnStatus)
        
        self.write(returnStatus)
        end = time.time()
        logmessage("timings POST call took {} seconds.".format(round(end-start,2)))

class unLock(tornado.web.RequestHandler):
     def get(self):
        # /API/unLock?route=${filename}&key=${globalApiKey}
        start = time.time()

        key = self.get_argument('key',default='')
        filename = self.get_argument('route',default='')

        if not checkAccess(key,'ADMIN'):
            self.set_status(400)
            self.write("Error: Need Admin level API Key.")
            return
        
        if not len(filename):
            self.set_status(400)
            self.write("Error: Invalid route.")
            return

        status = unLockFunc(filename=filename,key=key)
        self.write(status)
        end = time.time()
        logmessage("unLock GET call took {} seconds.".format(round(end-start,2)))

        
#################################

# 21.4.19
# from https://stackoverflow.com/a/55762431/4355695 : restrict direct browser access to .py files and stuff
class MyStaticFileHandler(tornado.web.StaticFileHandler):
    def validate_absolute_path(self, root, absolute_path):
        if any([absolute_path.endswith(x) for x in forbiddenEndings]) or any([ (x in absolute_path) for x in forbiddenPaths]):
            # raise tornado.web.HTTPError(403) # this is the usual thing: raise 403 Forbidden error. But instead..
            # self.write('YOU SHALL NOT PASS!')
            return os.path.join(root,'lib','errorpage.txt')
        
        if absolute_path.endswith('favicon.ico'):
            # gosh darnit this doesn't work on payanam site because the path itself is to server.nikhilvj.co.in
            return os.path.join(root,'lib','favicon.ico')

        return super().validate_absolute_path(root, absolute_path) # you may pass

'''
discard; load csv on js side using papa.parse

class getDatabank(tornado.web.RequestHandler):
    def get(self):
        # /API/getDatabank?searchName=${searchName}&fuzzyFlag=${fuzzyFlag}&jellyFlag=${jellyFlag}
        start = time.time()
        searchName = self.get_argument('searchName',default='')
        logmessage(searchName)
        fuzzyFlag = self.get_argument('fuzzyFlag',default='n')
        jellyFlag = self.get_argument('jellyFlag',default='n')

        with open(configFile) as f:
            configDict = json.load(f)
        databank = configDict.get('databank', 'hydstopsGoogle3.csv')

        try:
            df = pd.read_csv(databankFolder+databank)
        except OSError as e:
            logmessage('Error:',e)
            self.set_status(400)
            self.write('Error:' + str(e))
            return

        if jellyFlag == 'y':
            Jstart = time.time()
            df2 = jellyPanda(searchName,df)
            Jend = time.time()
            logmessage("Jellyfish scoring took {} seconds.".format(round(Jend-Jstart,3)))    
        else: df2 = df
        
        if fuzzyFlag == 'y':
            Fstart = time.time()
            df3 = fuzzyPanda(searchName,df2)
            Fend = time.time()
            logmessage("Fuzywuzzy scoring took {} seconds.".format(round(Fend-Fstart,3)))    
        else: df3 = df2
        
        rightJson = df3.to_json(orient='records', force_ascii=False)
        
        del df,df2,df3 # cleaning up
        
        self.write(rightJson)
        end = time.time()
        logmessage("getDatabank GET call took {} seconds.".format(round(end-start,2)))
'''
