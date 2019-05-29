def logmessage( *content ):
    timestamp = '{:%Y-%b-%d %H:%M:%S} :'.format(datetime.datetime.now())
    # from https://stackoverflow.com/a/26455617/4355695
    line = ' '.join(str(x) for x in list(content))
    # str(x) for x in list(content) : handles numbers in the list, converts them to string before concatenating. 
    # from https://stackoverflow.com/a/3590168/4355695
    print(line) # print to screen also
    f = open(os.path.join(logFolder, 'log.txt'), 'a', newline='\r\n', encoding='utf8') #open in append mode
    print(timestamp, line, file=f)
    # `,file=f` argument at end writes the line, with newline as defined, to the file instead of to screen. 
    # from https://stackoverflow.com/a/2918367/4355695
    f.close()

# quick lambda function to zap
zapper = lambda x: ''.join(e.lower() for e in str(x) if e.isalnum())


def recursiveDropdown(targetFolder = '.', ext=''):
    '''
    called from loadJsonsList API call
    recursiveDropdown(targetFolder = '.', ext='')
    recursively scans target folder for all files ending with extension ext (or all files by default), and generates innerHTML for a dropdown menu, with respective sub-folder paths as optgroups.
    '''
    if targetFolder.endswith('/'): targetFolder = targetFolder[:-1]
    content = '<option value="">Select one</option>'

    # traverse through all files, folders under a path recursively. from https://stackoverflow.com/a/2212698/4355695
    for root, subdirs, files in os.walk(targetFolder):
        folder = root[len(targetFolder)+1:]
        targetFiles = [x for x in files if x.lower().endswith(ext)]
        targetFiles.sort()
        
        if len(folder) and len(targetFiles):
            content += '<optgroup label="{}">'.format(folder)
        for file in targetFiles:
            filepath = os.path.join(root,file)[len(targetFolder)+1:]
            content += '<option value="{}">{}</option>'.format(filepath,file)
        if len(folder) and len(targetFiles):
            content += '</optgroup>'
    return content

def saveRoute(filename,data=[], key=False):
    if not os.path.exists(os.path.join(routesFolder,filename)):
        return 'Hey! this file {} doesnt even exist!'.format(filename)
    
    routeD = json.load(open(os.path.join(routesFolder,filename)), object_pairs_hook=OrderedDict)
    
    df = pd.DataFrame(data, dtype=str).fillna('')

    df0 = df[ (df['direction_id'] == '0') | (df['direction_id'] == '')].copy().reset_index(drop=True)
    df1 = df[ (df['direction_id'] == '1')].copy().reset_index(drop=True)

    # again, which one to loop through? 
    # How will the suggested stops come? Ok, let's embed them into the json array itself as another column, "suggested".
    # Structure of suggested: [source,lat,lon]; 
    # # ex: src5,34.45,122.54;osm,34.45,122.54
    # They'll get interpreted by the JS.
    # So all the data is with the df. We do a full replace of the stops arrays in the json.
    # note: we're not sorting here, those sequence numbers are just for show. taking stops in the order they're coming in.
    
    routeD['stopsArray0'] = [] #reset!
    for n,row in df0.iterrows():
        stopRow = OrderedDict({
            'stop_sequence': n+1,
            'stop_name' : row['stop_name'] if 'stop_name' in row else '',
            'stop_lat' : row['stop_lat'] if 'stop_lat' in row else '',
            'stop_lon' : row['stop_lon'] if 'stop_lon' in row else '',
            'stop_desc' : row['stop_desc'] if 'stop_desc' in row else '',
            'offset' : row['offset'] if 'offset' in row else '',
            'confidence' : row['confidence'] if 'confidence' in row else '',
            'suggested' : row['suggested'] if 'suggested' in row else ''
        })
        routeD['stopsArray0'].append(stopRow.copy())

    routeD['stopsArray1'] = [] #reset!
    for n,row in df1.iterrows():
        stopRow = OrderedDict({
            'stop_sequence': n+1,
            'stop_name' : row['stop_name'] if 'stop_name' in row else '',
            'stop_lat' : row['stop_lat'] if 'stop_lat' in row else '',
            'stop_lon' : row['stop_lon'] if 'stop_lon' in row else '',
            'stop_desc' : row['stop_desc'] if 'stop_desc' in row else '',
            'offset' : row['offset'] if 'offset' in row else '',
            'confidence' : row['confidence'] if 'confidence' in row else '',
            'suggested' : row['suggested'] if 'suggested' in row else ''
        })
        routeD['stopsArray1'].append(stopRow.copy())

    if key:
        info = userInfo(key)
        timestamp = '{:%Y.%m.%d - %H:%M:%S}'.format(datetime.datetime.now())
        saveRecord = OrderedDict()
        saveRecord['timestamp'] = timestamp
        saveRecord['email'] = info.get('email','')
        saveRecord['function'] = 'saveRoute'
        changes = routeD.get('changes',[])
        changes.append(saveRecord)
        routeD['changes'] = changes

        backup(os.path.join(routesFolder,filename))
        json.dump(routeD, open(os.path.join(routesFolder,filename), 'w'), indent=2)
        return 'Saved '+filename
    else:
        return('Bad Key so did nothing.')


def loadMappedStops():
    # 3.2.19 : now that report generation is doing this job, simply load up stops_mapped.csv!
    try:
        dfMapped = pd.read_csv(os.path.join(reportsFolder,'stops_mapped.csv'), dtype=str).fillna('')
    except FileNotFoundError as e:
        logmessage("Warning: Reports generation script has not been run yet. There is no CSV manually mapped stops in the reports folder.")
        dfMapped = pd.DataFrame()
    return dfMapped
    

def loadDataBank():
    databankHolder = list(configRules.get('databanksList',{}).values())
    if not len(databankHolder):
        logmessage("loadDataBank(): Warning: No databank listed in config.json under databanksList key.")
        return pd.DataFrame()
    
    databankFile = databankHolder[0]
    logmessage('loadDataBank(): Databank:',databankFile)
    try:
        dfDataBank = pd.read_csv( os.path.join(root,databankFile), dtype=str).fillna('')
        dfDataBank['zapped'] = dfDataBank['stop_name'].apply(zapper)
    except FileNotFoundError as e:
        logmessage("Warning: No databank file found.")
        dfDataBank = pd.DataFrame()
    return dfDataBank


def routeSuggestFunc(filename, dfMapped=[], dfDataBank=[], mapFirst=False, suggestManual=False, mapAgain=False, fuzzy=False, key=False):
    # def routeSuggestFunc(filename, options={}, key=False):
    '''
    this function will load a file, 
    process each stop,
    and then write that file back to disk.

    options:
    suggestManual: whether to do suggestions for stops that are already manually mapped. Default False.

    mapFirst: whether to assign the stop's lat and lon the first of the suggested values. default False.
    
    mapAgain: Whether to do the suggestion + mapping (if mapFirst) op for the automapped stops also (confidence=0), or to skip those and just look for the blank ones. Default False.
 
    fuzzy : Apply fuzzy matching instead of direct matching
    '''
    if not os.path.exists(os.path.join(routesFolder,filename)):
        logmessage('routeSuggestFunc: this file {} doesnt even exist! Exiting'.format(filename))
        return 'Hey! this file {} doesnt even exist!'.format(filename)
    
    # check and load banks
    if not len(dfDataBank): dfDataBank=loadDataBank()
    if not len(dfMapped): dfMapped=loadMappedStops()
    logmessage('Lengths: databank:{}, stops_mapped:{}'.format(len(dfDataBank),len(dfMapped)))
    
    routeD = json.load(open(os.path.join(routesFolder,filename)), object_pairs_hook=OrderedDict)
    depot = os.path.dirname(filename)
    logmessage('filename:',filename)
    count = 0
    suggestionsCount = 0

    # lets put both directions in one loop:
    for direction_id in ['0','1']:
        
        stopsArrayName = 'stopsArray' + direction_id
        for stopRow in routeD.get(stopsArrayName,[]):
            
            # first, get-out conditions:
            if not stopRow.get('stop_name',False): 
                logmessage('routeSuggestFunc: No stop_name found, dir:{}, file:{}'.format(direction_id, filename))
                continue 
            
            if stopRow.get('stop_lat',False) and ( stopRow.get('confidence','') not in ['0',0]) and not suggestManual :
                # this is a manually mapped stop. if suggestManual is false, don't bother looking for suggestions for this and move on.
                continue
            
            if stopRow.get('stop_lat',False) and ( stopRow.get('confidence','1') in ['0',0]) and not mapAgain:
                # this is an auto-mapped stop. if mapAgain is false, don't bother with this and move on.
                continue

            # get suggestions:
            lat, lon, suggestionStr = suggestLocations(stop_name=stopRow.get('stop_name',''), depot=depot, direction_id=direction_id, dfMapped=dfMapped, dfDataBank=dfDataBank, fuzzy=fuzzy )

            if len(suggestionStr):
                stopRow['suggested'] = suggestionStr
                # this way, a blank suggestion does not replace an already populated one.
                suggestionsCount += 1

            if stopRow.get('stop_lat',False) and ( stopRow.get('confidence','') not in ['0',0]):
                # suggestions toh ho gaya, but this is a manually mapped stop. No mapping!
                continue

            if mapFirst and lat and lon:
                if ( not stopRow.get('stop_lat',False) ) or \
                    ( stopRow.get('stop_lat',False) and ( stopRow.get('confidence','1') in ['0',0]) and mapAgain ) :
                    # map this stop if it's blank; or if its an automapped stop provided mapAgain=true
                    stopRow['stop_lat'] = lat
                    stopRow['stop_lon'] = lon
                    stopRow['confidence'] = '0' # indicates it was auto-mapped
                    count += 1
    
    logmessage(count,'stops mapped,',suggestionsCount,'stops given sugggestions.')
    backup(os.path.join(routesFolder,filename))
    
    if key:
        info = userInfo(key)
        timestamp = '{:%Y.%m.%d - %H:%M:%S}'.format(datetime.datetime.now())
        saveRecord = OrderedDict()
        saveRecord['timestamp'] = timestamp
        saveRecord['email'] = info.get('email','')
        saveRecord['function'] = 'routeSuggestFunc'
        changes = routeD.get('changes',[])
        changes.append(saveRecord)
        routeD['changes'] = changes

    else:
        logmessage('Nope, not doing anything without an API key!')
        return 'Please provide API key'


    json.dump(routeD, open(os.path.join(routesFolder,filename), 'w'), indent=2)

    if mapFirst:
        appendString = ', {} stops auto-mapped.'.format(count)
    else: 
        appendString = ''
    
    return '{} stops mapped, {} stops given sugggestions in {}{}'.format(count,suggestionsCount,filename, appendString)


def routeLockFunc(filename, key):
    
    backup(os.path.join(routesFolder,filename))
    routeD = json.load(open(os.path.join(routesFolder,filename)), object_pairs_hook=OrderedDict)
    if key:
        info = userInfo(key)
        timestamp = '{:%Y.%m.%d - %H:%M:%S}'.format(datetime.datetime.now())
        saveRecord = OrderedDict()
        saveRecord['timestamp'] = timestamp
        saveRecord['email'] = info.get('email','')
        saveRecord['function'] = 'routeLockFunc'
        changes = routeD.get('changes',[])
        changes.append(saveRecord)
        routeD['changes'] = changes
    
    dstdir =  os.path.join(lockFolder, os.path.dirname(filename))
    os.makedirs(dstdir, exist_ok=True)

    json.dump(routeD, open(os.path.join(lockFolder,filename), 'w'), indent=2)
    logmessage('routeLockFunc: Wrote {} to locked folder'.format(filename))
    
    try: 
        # shutil.copy(os.path.join(routesFolder,filename), dstdir)
        # copied. now remove
        os.remove(os.path.join(routesFolder,filename))
    except Exception as e:
        logmessage('Exception encountered in trying to remove {}'.format(os.path.join(routesFolder,filename) ))
        logmessage(e)

    return '{} moved to locked routes folder.'.format(filename)


def getallFiles(targetFolder, ext='.json'):
    collector = []
    for root, subdirs, files in os.walk(targetFolder):
        targetFiles = [x for x in files if x.lower().endswith(ext)]
        targetFiles.sort()
        [ collector.append(os.path.join(root,x)) for x in targetFiles ]
    return collector

# imported from static gtfs manager
def lat_long_dist(lat1,lon1,lat2,lon2):
    # function for calculating ground distance between two lat-long locations
    R = 6373.0 # approximate radius of earth in km. 

    lat1 = radians( float(lat1) )
    lon1 = radians( float(lon1) )
    lat2 = radians( float(lat2) )
    lon2 = radians( float(lon2) )

    dlon = lon2 - lon1
    dlat = lat2 - lat1

    a = sin(dlat / 2)**2 + cos(lat1) * cos(lat2) * sin(dlon / 2)**2
    c = 2 * atan2(sqrt(a), sqrt(1 - a))

    distance = float(format( R * c , '.2f' )) #rounding. From https://stackoverflow.com/a/28142318/4355695
    return distance


def backup(filepath):
    # make timestamp for backup string
    backupSuffix = '_{:%Y%m%d-%H%M%S}'.format(datetime.datetime.now())
    destinationPath = os.path.join(backupsFolder, filepath[len(root)+1:] + backupSuffix)

    # copy folder paths
    try:
        os.makedirs(os.path.dirname(destinationPath))
    except FileExistsError as e:
        # folder exists
        pass
    
    try: 
        shutil.copy(filepath, destinationPath)
    except Exception as e:
        logmessage('backup: Error in copying {} to {}: {}'.format(filepath,destinationPath,e))
        return False
    
    return backupSuffix


def routeSource(stopRow):
    # called from inside the suggestionLocations function. gets one row if a DF
    sourceString = stopRow['routeName'] if stopRow['routeName'] else stopRow['jsonFile'].split('.')[0]
    sourceString += '(done)' if stopRow['workStatus'] == 'locked' else ''
    # logmessage(sourceString)
    return sourceString


def suggestLocations(stop_name, depot, direction_id, dfMapped, dfDataBank, fuzzy=False ):
    
    stop_name_zap = zapper(stop_name)
    
    if (not len(dfMapped)) or (not len(dfDataBank)):
        logmessage('please pass in the dataframes!')
        return '','',''
    
    dfMapped['zapped'] = dfMapped['stop_name'].apply(zapper)
    # to do : move the application of zapping outside to calling function
    
    # filter 1 : get name matches
    if not fuzzy:
        # direct match
        filter1 = dfMapped[ dfMapped['zapped'] == stop_name_zap ].copy().reset_index(drop=True)
    else:
        # dfMapped['Fpartial'] = dfMapped['zapped'].apply( lambda x: fuzz.partial_ratio(stop_name_zap,x) )
        dfMapped['JjaroW'] = dfMapped['zapped'].apply( lambda x: jf.jaro_winkler(stop_name_zap,x) )
        
        numRows = configRules.get('fuzzyTopN',5)
        filter1 = dfMapped[dfMapped['JjaroW'] >= 0.8 ].sort_values('JjaroW',ascending=False).head(numRows).copy().reset_index(drop=True)
        # below 0.8, observed its normally too much mismatch, so limiting it. Will help make the program faster too.

    #---------------------
    def rankingFunc(stopRow):
        rank = 0
        # 1st priority : confidence
        if stopRow['confidence'].isdigit():
            if int(stopRow['confidence']) > 3:
                rank += 12 + int(stopRow['confidence']) # so 4 or 5, nudge 5 higher. Default: 16

        # 2nd priority : same depot and direction
        if stopRow['depot'] == depot and stopRow['direction_id'] == direction_id :
            rank += 8

        elif stopRow['direction_id'] == direction_id:
            # 4th priority : at least direction is matching
            # have to chain it as else of first to avoid unnecessary repeat-ranking
            rank += 2

        # 3rd priority : locked. This adds to already earned ranks.
        if stopRow['workStatus'] == 'locked':
            rank += 4

        return rank
    # ------------

    if len(filter1): 
        filter1['rank'] = filter1.apply(rankingFunc, axis=1)
    
        # filter2 : sort by rank, and get rid of duplicates by lat-long
        filter2 = filter1.sort_values('rank',ascending=False).copy().reset_index(drop=True)
    
        # lets give this a source column, same as original route and mention if locked
        filter2['source'] = filter2.apply(routeSource, axis=1)
    
    else:
        filter2 = pd.DataFrame()
    
    # now databank. It should already have zapped column.
    if not fuzzy:
        dbfilter1 = dfDataBank[ dfDataBank['zapped'] == stop_name_zap ].copy().reset_index(drop=True)
    else:
        # dfDataBank['Fpartial'] = dfDataBank['zapped'].apply( lambda x: fuzz.partial_ratio(stop_name_zap,x) )
        dfDataBank['JjaroW'] = dfDataBank['zapped'].apply( lambda x: jf.jaro_winkler(stop_name_zap,x) )
        
        numRows = configRules.get('fuzzyTopN',5)
        dbfilter1 = dfDataBank[dfDataBank['JjaroW'] >= 0.8 ].sort_values('JjaroW',ascending=False).head(numRows).copy().reset_index(drop=True)

    if len(dbfilter1):
        # make 'workStatus' column here too and assign it as 'databank'
        dbfilter1['workStatus'] = 'databank'
    
    ## Concatenating mapped stops and databank stops
    filter3 = pd.concat([filter2, dbfilter1], ignore_index=True, sort=False).fillna('')
    
    if not len(filter3):
        # no matches anywhere! Exit!
        # logmessage('No matches found for stop {}'.format(stop_name))
        return '','',''
    
    # Removing duplicates by lat-long; higher-priority ones remain
    filter4 = filter3.drop_duplicates(subset=['stop_lat','stop_lon']).copy().reset_index(drop=True)
    
    logmessage('"{}": {} mapped, {} databank matches found. Ranked and boiled down to {} matches.'.format(stop_name, len(filter1), len(dbfilter1), len(filter4) ))

    # first lat-lon
    lat = filter4['stop_lat'].iloc[0]
    lon = filter4['stop_lon'].iloc[0]

    # creating string
    if not fuzzy:
        filter4['verbose'] = filter4.apply(lambda x: '{},{},{}'.format(x['source'],x['stop_lat'],x['stop_lon']), axis=1)
    else:
        # 10.2.19 : if fuzzy, then put in stop_name as well.
        filter4['verbose'] = filter4.apply(lambda x: '{},{},{},{}'.format(x['source'],x['stop_lat'],x['stop_lon'],x['stop_name'].replace(';','_').replace(',','_')), axis=1)
    
    suggestion = ';'.join( filter4['verbose'].tolist() )
    return lat, lon, suggestion


def getallRoutes(targetFolder=routesFolder, ext='.json'):
    collector = []
    for root, subdirs, files in os.walk(targetFolder):
        targetFiles = [x for x in files if x.lower().endswith(ext)]
        folder = root[len(targetFolder)+1:] # cut out the beginning full path
        [ collector.append(os.path.join(folder,x)) for x in targetFiles ]
    collector.sort() # keep it sorted! on server it seems the natural load has no particular order.
    return collector


def userInfo(key):
    # accessFile,configFolder
    keysdf = pd.read_csv(os.path.join(configFolder,accessFile), dtype=str, index_col='key').fillna('')
    try:
        returnObj = { 'name': keysdf.at[key,'name'], 'email': keysdf.at[key,'email'], 'access': keysdf.at[key,'access']  }
    except KeyError as e:
        returnObj = False
    return returnObj


def checkAccess(key, desired="VIEWER"):
    keysdf = pd.read_csv(os.path.join(configFolder,accessFile), dtype=str, index_col='key').fillna('')
    try:
        currentAccess = keysdf.at[key,'access']
        try:
            returnStatus = accessRanking.index(currentAccess) >= accessRanking.index(desired)
            # accessRanking is a list defined in launch.py, like ["VIEW","MAPPER","DATAENTRY","REVIEW","ADMIN"]
            # this statement gives True if the access level possessed by the user is greater than or equal to the desired access level
        except ValueError:
            # one or both of the access level values isn't present in accessRanking list
            returnStatus = False

    except KeyError as e:
        # key provided is invalid
        returnStatus = False

    return returnStatus

################################

def sanityCheck(stopRow,beforeLat,beforeLon,afterLat,afterLon):
    '''
    10.2.19 : New Sanitycheck function
    - As input, just take the main stop row json, and lat-longs of before and after
    - This function has to decide if the present mapping is crap, then give the best-placed suggestion as alternative.
    - if no fitting alternative was found, then exit with return False
    - if the present mapping is found to be ok, then just exit with return None
    - if a proper alternative is found, then return the number (starting from 0) of the suggestion which worked.
    - all executive action takes place elsewhere
    
    requirements: only pass in a stopRow having valid lat-longs!

    return values:
    None : All good / no change needed.
    False : Not good, and no alternatives found. Advise to un-map this stop
    [lat, lon] : recommended alternative location that's closest to neighbors
    '''
    sanityDistance = configRules.get('sanityDistance',7)
    
    if not stopRow.get('stop_lat',False):
        logmessage('sanityCheck: Hey, give me a mapped stop!')
        return None
    
    try:
        # logmessage('\n\n',stopRow)
        # logmessage('Surrounding lat-longs: Before:',beforeLat,beforeLon,' After:',afterLat,afterLon)
        lat = float( stopRow.get('stop_lat','') )
        lon = float( stopRow.get('stop_lon','') )
        beforeLat = float(beforeLat)
        beforeLon = float(beforeLon)
        afterLat = float(afterLat)
        afterLon = float(afterLon)
    except ValueError as e:
        logmessage(e)
        logmessage('sanityCheck: Hey, give me a stop mapped with floating point numbers! Stop:',stopRow.get('stop_name',''))
        return None
    
    dist1 = lat_long_dist(lat,lon,beforeLat,beforeLon)
    dist2 = lat_long_dist(lat,lon,afterLat,afterLon)
    
    if dist1 <= sanityDistance and dist2 <= sanityDistance :
        # logmessage('Stop {} seems fine, before:{} km, after:{} km.'.format(stopRow.get('stop_name',''),dist1,dist2 ))
        return None
    
    logmessage('sanityCheck for {}: before:{} km, after:{} km. Needs change.'.format(stopRow.get('stop_name',''),dist1,dist2 ))
    
    # now we start trying the alternatives
    suggestionList = stopRow.get('suggested','').split(';')
    # logmessage('There are {} suggestions.'.format(len(suggestionList)))
    if len(suggestionList)<2 or not suggestionList[0]:
        # there aren't any suggestions! Skip!
        return None
    
    minDist = 1000
    minN = None
    chosenLat = None
    chosenLon = None
    for n,suggestionText in enumerate(suggestionList):
        sug = suggestionText.split(',')
        if len(sug) < 3: continue
        
        try:
            lat = float(sug[1])
            lon = float(sug[2])
        except:
            continue
        dist1 = lat_long_dist(lat,lon,beforeLat,beforeLon)
        dist2 = lat_long_dist(lat,lon,afterLat,afterLon)
        # print(dist1+dist2)
        if dist1 <= sanityDistance and dist2 <= sanityDistance :
            # success! Found a suggestion that's sane!
            if (dist1 + dist2) < minDist:
                # print('Suggestion {}:{} has lower distance: {}'.format(n,suggestionText,(dist1 + dist2)))
                minDist = dist1 + dist2
                minN = n
                chosenLat = lat
                chosenLon = lon

    # after working our way through the suggestions list, settle on the minimum possible
    if minN is not None:
        logmessage('Suggestion {}: {} is a good fit for {}'.format(minN,suggestionList[minN],stopRow.get('stop_name','')))
        return [chosenLat,chosenLon]
      
    # if it gets here, then it means none of the suggestions worked.
    logmessage(stopRow.get('stop_name',''),': no alternatives found in suggestions.')
    return False

def sanityFunc(filename,key=None,dryRun=True):
    # this function should do like bulk mapping : loop through all the files,
    # call sanityCheck
    logmessage('dryRun:',dryRun)
    
    changesCount = 0
    removedCount = 0
    routeD = json.load(open(os.path.join(routesFolder,filename),'r'), object_pairs_hook=OrderedDict)
    for direction_id in ['0','1']:

        mappedInd = []
        lastStopRemoved = 0
        for i,stopRow in enumerate( routeD.get('stopsArray{}'.format(direction_id),[]) ):
            if stopRow.get('stop_lat',False):
                mappedInd.append(i)
            
            # temp quick-fix : if lat-long is to blank but confidence value still there, then set confidence to blank as well:
            if not routeD['stopsArray{}'.format(direction_id)][i].get('stop_lat',None):
                routeD['stopsArray{}'.format(direction_id)][i]['confidence'] = ''

            # another quick-fix, for earlier routes: were mapped but confidence level wasn't introduced back then. Assign 1.
            else:
                if not routeD['stopsArray{}'.format(direction_id)][i].get('confidence',''):
                    routeD['stopsArray{}'.format(direction_id)][i]['confidence'] = '1'
        
        logmessage('{} direction {}: {} mapped stops'.format(filename,direction_id,len(mappedInd)))
        
        # take only mapped stops
        for n,ind in enumerate(mappedInd):
            if ((n-1) < 0) or ((n+1) >= len(mappedInd)) or ( routeD['stopsArray{}'.format(direction_id)][mappedInd[n]].get('confidence','') not in [0,'0']):
                # so skip first and last, and also don't bother the manually mapped stops.
                previousOffset = 0 # if manually mapped stop, reset the offset so this gets considered in next run
                continue
            
            previousOffset = n-1
            if 0 < lastStopRemoved < 3: 
                previousOffset -= lastStopRemoved
            if lastStopRemoved > 2:
                logmessage('Too many prior stops removed, so skipping sanityCheck for next one.')
                lastStopRemoved = 0 # reset, so for next one there is a before-location.
                continue
            
            beforeLat = routeD['stopsArray{}'.format(direction_id)][mappedInd[previousOffset]].get('stop_lat')
            beforeLon = routeD['stopsArray{}'.format(direction_id)][mappedInd[previousOffset]].get('stop_lon')
            afterLat = routeD['stopsArray{}'.format(direction_id)][mappedInd[n+1]].get('stop_lat')
            afterLon = routeD['stopsArray{}'.format(direction_id)][mappedInd[n+1]].get('stop_lon')
            recco = sanityCheck(routeD['stopsArray{}'.format(direction_id)][mappedInd[n]],beforeLat,beforeLon,afterLat,afterLon)

            if type(recco) == list:
                logmessage('taking new lat-longs:',recco)
                routeD['stopsArray{}'.format(direction_id)][mappedInd[n]]['stop_lat'] = str(recco[0])
                routeD['stopsArray{}'.format(direction_id)][mappedInd[n]]['stop_lon'] = str(recco[1])
                routeD['stopsArray{}'.format(direction_id)][mappedInd[n]]['confidence'] = '0'
                changesCount += 1
                lastStopRemoved = 0 # reset it
            
            elif recco is False:
                routeD['stopsArray{}'.format(direction_id)][mappedInd[n]]['stop_lat'] = ''
                routeD['stopsArray{}'.format(direction_id)][mappedInd[n]]['stop_lon'] = ''
                routeD['stopsArray{}'.format(direction_id)][mappedInd[n]]['confidence'] = ''
                lastStopRemoved += 1
                removedCount += 1


    # after whole json has been traversed
    returnMessage = 'sanityFunc: Route {} should have {} stops re-mapped, {} stops de-mapped. '.format(filename,changesCount,removedCount)
    if not dryRun and key:
        if changesCount or removedCount :
            info = userInfo(key)
            timestamp = '{:%Y.%m.%d - %H:%M:%S}'.format(datetime.datetime.now())
            saveRecord = OrderedDict()
            saveRecord['timestamp'] = timestamp
            saveRecord['email'] = info.get('email','')
            saveRecord['function'] = 'sanityFunc'
            changes = routeD.get('changes',[])
            changes.append(saveRecord)
            routeD['changes'] = changes

            backup(os.path.join(routesFolder,filename)) # make backup!
            json.dump(routeD, open(os.path.join(routesFolder,filename), 'w'), indent=2)
            returnMessage += 'Changed and saved {}'.format(filename)
            logmessage(returnMessage)
        else:
            returnMessage += 'No changes needed.'
            logmessage(returnMessage)
    
    else:
        returnMessage += 'Dry Run, so no changes done.'
        logmessage(returnMessage)

    return returnMessage
    # sanityFunc function end


def saveDataEntryRoute(filename,data={}, key=False):
    changesMade = False
    noBackup = False

    if not os.path.exists(os.path.join(routesFolder,filename)):
        logmessage('Note: this route {} is completely new.'.format(filename))
        noBackup = True
        if os.path.exists(os.path.join(lockFolder,filename)):
            returnMessage = 'Hey, this route {} is in locked routes folder! Unlock it (move back to routes folder) then do this.'.format(filename)
            logmessage(returnMessage)
            return returnMessage

        # intervention, 24.4.19: Create a new folder for the depot if not already made
        depot = filename.split('/')[0]
        if not os.path.exists(os.path.join(routesFolder, depot)):
            os.makedirs(os.path.join(routesFolder, depot),  exist_ok=True)
        logmessage('Created new depot folder: {}'.format(depot))

        routeD = OrderedDict()

    else:
        routeD = json.load(open(os.path.join(routesFolder,filename)), object_pairs_hook=OrderedDict)

    # to do: go through the incoming data
    # make changes where changes are needed.
    # leave everything else untouched.

    if routeD.get('routeName','') != data.get('routeName',''):
        routeD['routeName'] = data.get('routeName','')
        changesMade = True
    
    if routeD.get('routeFileName','') != data.get('routeFileName',''):
        routeD['routeFileName'] = data.get('routeFileName','')
        changesMade = True
    
    if routeD.get('routeLongName','') != data.get('routeLongName',''):
        routeD['routeLongName'] = data.get('routeLongName','')
        changesMade = True
    
    if routeD.get('depot','') != data.get('depot',''):
        routeD['depot'] = data.get('depot','')
        changesMade = True
    
    if routeD.get('busType','') != data.get('busType',''):
        routeD['busType'] = data.get('busType','')
        changesMade = True

    if routeD.get('extra0','') != data.get('extra0',''):
        routeD['extra0'] = data.get('extra0','')
        changesMade = True
    
    if routeD.get('extra1','') != data.get('extra1',''):
        routeD['extra1'] = data.get('extra1','')
        changesMade = True
    

    # and now we proceed to <gulp> rewrite the stop sequences!
    # don't worry, backups happening. Damn gotta have an easy way to restore backups..

    for direction_id in ['0','1']:    
        stopLinesHolder = data.get('stops{}'.format(direction_id),'').split('\n')
        
        # if len(stopLinesHolder)<2: continue # error out # 19.5.19 : intervention: this was not letting us delete return trips in cases where there is only onward trip. So, trust the data entry folks, rely on backups.
        
        stopCollector = []
        for stopLine in stopLinesHolder:
            stopLine = stopLine.strip()
            if not len(stopLine):
                logmessage('Blank line encountered')
                continue

            if '|' not in stopLine:
                # just a name, all the same, on with the game
                stopCollector.append({'stop_name': stopLine})
                # logmessage('stop with only name encountered:',stopLine)
                continue

            stopParts = stopLine.split('|')
            row = OrderedDict()
            row['stop_name'] = stopParts[0]
            # 22.5.19 Intervention : for lat-long and confidence values, strip out all non-numeric chars
            if len(stopParts) >= 3:
                row['stop_lat'] = ''.join([c for c in stopParts[1] if c in '1234567890.-'])
                row['stop_lon'] = ''.join([c for c in stopParts[2] if c in '1234567890.-'])
            if len(stopParts) > 3:
                row['confidence'] = ''.join([c for c in stopParts[3] if c in '1234567890'])
            
            stopCollector.append(row.copy())

        if len(stopCollector):
            routeD['stopsArray{}'.format(direction_id)] = stopCollector.copy()
            changesMade = True
        else:
            # 22.4.19 : Crap, this part was also preventing us from blanking out return journeys
            logmessage("saveDataEntryRoute: Warning: {}: Direction {} is completely blank now.".format(filename,direction_id))
            routeD['stopsArray{}'.format(direction_id)] = []
            changesMade = True

    
    # logmessage(json.dumps(routeD, indent=2))

    # ''' # uncomment when ready
    if changesMade and key:
        info = userInfo(key)
        timestamp = '{:%Y.%m.%d - %H:%M:%S}'.format(datetime.datetime.now())
        saveRecord = OrderedDict()
        saveRecord['timestamp'] = timestamp
        saveRecord['email'] = info.get('email','')
        saveRecord['function'] = 'saveDataEntryRoute'
        changes = routeD.get('changes',[])
        changes.append(saveRecord)
        routeD['changes'] = changes

        if not noBackup: # nothing to back up if it's a new kid on the block
            backup(os.path.join(routesFolder,filename)) 
        json.dump(routeD, open(os.path.join(routesFolder,filename), 'w'), indent=2)
        return 'Saved '+filename
    else:
        return('Bad Key so did nothing.')
    # '''

def changeStop(key,folder,jsonFile,direction_id,searchName,\
    recon_stop_name,recon_stop_desc,recon_stop_lat,recon_stop_lon):
    
    filename = os.path.join(folder,jsonFile)
    # if not os.path.exists(filename):

    routeD = json.load(open(os.path.join(routesFolder,filename)), object_pairs_hook=OrderedDict)

    if direction_id in [1,'1']:
        stopsList = "stopsArray1"
    else:
        stopsList = "stopsArray0"
    
    changesCount = 0
    for stopRow in routeD.get(stopsList,[]):
        if stopRow.get('stop_name','') != searchName: continue
        stopRow['stop_name'] = recon_stop_name
        stopRow['stop_desc'] = recon_stop_desc
        stopRow['stop_lat'] = str(recon_stop_lat)
        stopRow['stop_lon'] = str(recon_stop_lon)
        stopRow['confidence'] = "6"
        stopRow.pop('suggested',None) # remove suggestions if any
        changesCount += 1
    
    if changesCount and key:
        info = userInfo(key)
        timestamp = '{:%Y.%m.%d - %H:%M:%S}'.format(datetime.datetime.now())
        saveRecord = OrderedDict()
        saveRecord['timestamp'] = timestamp
        saveRecord['email'] = info.get('email','')
        saveRecord['function'] = 'reconcile'
        changes = routeD.get('changes',[])
        changes.append(saveRecord)
        routeD['changes'] = changes

        backup(os.path.join(routesFolder,filename))
        json.dump(routeD, open(os.path.join(routesFolder,filename), 'w'), indent=2)
        return "{}|{}: \"{}\" replaced, {} change(s) done and saved.".format(filename,direction_id,searchName,changesCount)
    else:
        return "{}|{}: no changes, \"{}\" not found.".format(filename,direction_id,searchName)

def routeLine(folder,jsonFile,direction_id):
    filename = os.path.join(folder,jsonFile)
    
    collector = []
    if not os.path.exists(os.path.join(routesFolder,filename)):
        return collector
    
    routeD = json.load(open(os.path.join(routesFolder,filename)), object_pairs_hook=OrderedDict)
    
    if direction_id in [1,'1']:
        stopsList = routeD.get("stopsArray1",[])
    else:
        stopsList = routeD.get("stopsArray0",[])

    for stopRow in stopsList:
        if (not stopRow.get('stop_lat',False)) or (not stopRow.get('stop_lon',False)): continue
        try:
            lat = float(stopRow.get('stop_lat'))
            lon = float(stopRow.get('stop_lon'))
            collector.append([lat,lon])
        except: 
            pass
    return collector

def removeAutoMapping(key,really=False, deSuggest=False):
    '''To do : remove all automapping and suggestions from all routes
    BUT keep all the manual mapping intact.
    '''
    routesList = getallRoutes()

    returnList = []
    for filename in routesList:
        routeD = json.load(open(os.path.join(routesFolder,filename)), object_pairs_hook=OrderedDict)
        deMapCount = 0
        deSuggestCount = 0
        for dirArray in ['stopsArray0','stopsArray1']:
            for stopRow in routeD.get(dirArray,[]):
                if stopRow.get('confidence','') in [0,'0']:
                    # if it's automapped
                    stopRow.pop('confidence',None)
                    stopRow.pop('stop_lat',None)
                    stopRow.pop('stop_lon',None)
                    deMapCount += 1
                
                if deSuggest and stopRow.get('suggested',False):
                    stopRow.pop('suggested',None)
                    deSuggestCount += 1
        
        if (deMapCount == 0) and (deSuggestCount == 0) : 
            logmessage("removeAutoMapping: {}: No changes.".format(filename))
            continue
        
        if key and really:
            info = userInfo(key)
            timestamp = '{:%Y.%m.%d - %H:%M:%S}'.format(datetime.datetime.now())
            saveRecord = OrderedDict()
            saveRecord['timestamp'] = timestamp
            saveRecord['email'] = info.get('email','')
            saveRecord['function'] = 'removeAutoMapping'
            changes = routeD.get('changes',[])
            changes.append(saveRecord)
            routeD['changes'] = changes

            backup(os.path.join(routesFolder,filename))
            json.dump(routeD, open(os.path.join(routesFolder,filename), 'w'), indent=2)
            message = "removeAutoMapping: {}: {} automappings, {} suggestions removed. Saved file."\
                .format(filename,deMapCount,deSuggestCount)
            logmessage(message)
            returnList.append(message)
            
        else:
            message = "removeAutoMapping: {}: No changes made, but could remove {} automappings, {} suggestions."\
                .format(filename,deMapCount,deSuggestCount)
            logmessage(message)
            returnList.append(message)

    return returnList

def storeTimings(filename,data,key):
    if not os.path.exists(os.path.join(routesFolder,filename)):
        return 'Hey! this file {} doesnt even exist!'.format(filename)
    
    routeD = json.load(open(os.path.join(routesFolder,filename)), object_pairs_hook=OrderedDict)

    if (not routeD.get('timeStructure_0',False)) and (not routeD.get('timeStructure_1',False)):
        logmessage("storeTimings: Saving timings data for first time for route",filename)
    
    # let specfics vary; over-write the whole timeStructure_{} objects in the json
    routeD['timeStructure_0'] = data.get('timeStructure_0',{}).copy()
    routeD['timeStructure_1'] = data.get('timeStructure_1',{}).copy()
    
    if key:
        info = userInfo(key)
        timestamp = '{:%Y.%m.%d - %H:%M:%S}'.format(datetime.datetime.now())
        saveRecord = OrderedDict()
        saveRecord['timestamp'] = timestamp
        saveRecord['email'] = info.get('email','')
        saveRecord['function'] = 'storeTimings'
        changes = routeD.get('changes',[])
        changes.append(saveRecord)
        routeD['changes'] = changes

        backup(os.path.join(routesFolder,filename))
        json.dump(routeD, open(os.path.join(routesFolder,filename), 'w'), indent=2)
        return "{}: timings data saved.".format(filename)
    else:
        return "{}: no changes, invalid API ke.".format(filename,direction_id,searchName)

def unLockFunc(filename,key):
    if not os.path.exists(os.path.join(lockFolder,filename)):
        return 'Hey! this file {} is not there in locked routes folder!'.format(filename)
    
    backup(os.path.join(lockFolder,filename))
    routeD = json.load(open(os.path.join(lockFolder,filename)), object_pairs_hook=OrderedDict)
    if key:
        info = userInfo(key)
        timestamp = '{:%Y.%m.%d - %H:%M:%S}'.format(datetime.datetime.now())
        saveRecord = OrderedDict()
        saveRecord['timestamp'] = timestamp
        saveRecord['email'] = info.get('email','')
        saveRecord['function'] = 'unLockFunc'
        changes = routeD.get('changes',[])
        changes.append(saveRecord)
        routeD['changes'] = changes
    
    dstdir =  os.path.join(routesFolder, os.path.dirname(filename))
    os.makedirs(dstdir, exist_ok=True) # does nothing if the folder already exists.
    
    json.dump(routeD, open(os.path.join(routesFolder,filename), 'w'), indent=2)
    logmessage('unLockFunc: Saved {} to routes folder'.format(filename))
    
    try: 
        # shutil.copy(os.path.join(routesFolder,filename), dstdir)
        # copied. now remove
        os.remove(os.path.join(lockFolder,filename))
        logmessage('unLockFunc: Removed {} from locked routes folder'.format(filename))

    except Exception as e:
        logmessage('Exception encountered in trying to remove {}'.format(os.path.join(lockFolder,filename) ))
        logmessage(e)

    return '{} moved to routes folder.'.format(filename)


def logUse(action='launch',type='visitor'):
    comment='''
    have shared this online with more explanation. See https://gist.github.com/answerquest/1cee6b567644dfe9c4449979b9aaa2db
    values for type : 
        visitor: normal page views
        read: if specific route loaded etc
        write: changes made to single route
        bulk: bulk actions
    '''
    payload = {'idsite': 6,  'rec': 1, 'send_image':0}
    payload['action_name'] = action
    cvar = {}
    cvar['1'] = ['type', type]
    cvar['2'] = ['OS', platform.system()]
    cvar['3'] = ['processor',platform.processor()]
    if cvar['2'][1] == 'Linux':
        cvar['2'][1] = platform.linux_distribution()[0]
        cvar['4'] = ['version', platform.linux_distribution()[1] ]
    else:
        cvar['4'] = ['version', platform.release() ]
    payload['_cvar'] = json.dumps(cvar)
    try:
        r = requests.get('https://nikhilvj.co.in/tracking/piwik.php', params=payload, verify=False, timeout=1)
    except requests.exceptions.RequestException as e:
        # print('exception',e)
        pass

def depotsListFunc():
    # from https://stackoverflow.com/a/3207973/4355695
    d = []
    for (dirpath, dirnames, filenames) in os.walk(routesFolder):
        d.extend(dirnames)
        break
    d.sort() # always sort!
    logmessage(d)
    content = '<option value="">(All - ignore this line)</option>'
    for subfolder in d:
        content+= '<option value="{}">{}</option>'.format(subfolder,subfolder)
    
    return content



## GRAVEYARD

'''
def findNameSuggestions(stop_name, databankDF, lockedBankDF=pd.DataFrame(), direction_id=0):
    
    matchCollector = []
    otherDirCollector = []
    finalcollector = []

    # to do: search lockedBankDF and add matches, then search databankDF and add matches.
    # doing just databank for now.

    stop_name_zap = zapper(stop_name)
    matchDatabankDF = databankDF[ databankDF['zapped'] == stop_name_zap ].copy().reset_index(drop=True)

    if len(matchDatabankDF):
        matchDatabankDF['verbose'] = matchDatabankDF.apply(lambda x: '{},{},{}'.format(x['source'],x['stop_lat'],x['stop_lon']), axis=1)
        finalcollector +=  matchDatabankDF['verbose'].tolist()
    #databankFolder

    return ';'.join(finalcollector)

'''
