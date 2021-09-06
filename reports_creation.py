'''
6.1.19 By Nikhil VJ
Program to capture stop details from all json files in CSV format
.. to generate detail and summary CSV's that are used in bulk editing etc,
.. and to generate shapefiles per depot
'''

import pandas as pd
import json, os, time, datetime
from collections import OrderedDict
import statistics
import numpy as np
from shapely.geometry import Polygon
import geojson

times = []
times.append(time.time())
# setting constants
root = os.path.dirname(__file__) # needed for tornado and all other paths, prog should work even if called from other working directory.
routesFolder = os.path.join(root,'routes')
lockFolder = os.path.join(root,'locked-routes')
reportsFolder = os.path.join(root,'reports')
logFolder = os.path.join(root,'reports/logs')
shapesFolder = os.path.join(reportsFolder,'shapes')
backupsFolder = os.path.join(root,'backups')


# create folders if they don't exist
for folder in [routesFolder, lockFolder, logFolder, reportsFolder, shapesFolder]:
    if not os.path.exists(folder):
        os.makedirs(folder)


def logmessage( *content ):
    timestamp = '{:%Y-%b-%d %H:%M:%S} :'.format(datetime.datetime.utcnow() + datetime.timedelta(hours=5.5))
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

####################
#-------- CONVEX HULL
def split(u, v, points):
    # return points on left side of UV
    return [p for p in points if np.cross(p - u, v - u) < 0]

def extend(u, v, points):
    if not points:
        return []
    # find furthest point W, and split search to WV, UW
    w = min(points, key=lambda p: np.cross(p - u, v - u))
    p1, p2 = split(w, v, points), split(u, w, points)
    return extend(w, v, p1) + [w] + extend(u, w, p2)

def convex_hull(points):
    # find two hull points, U, V, and split to left and right search
    u = min(points, key=lambda p: p[0])
    v = max(points, key=lambda p: p[0])
    left, right = split(u, v, points), split(v, u, points)
    
    # find convex hull on each side
    return [v] + extend(u, v, left) + [u] + extend(v, u, right) + [v]

#---- grouping
def listORone(ser):
    set1 = set(ser.tolist())
    if '' in set1:
        set1.remove('')
    return ', '.join(set1) if len(set1)>1 else ser.iloc[0]

# quick lambda function to zap
zapper = lambda x: ''.join(e.lower() for e in str(x) if e.isalnum())

##########
# Initialization

stopsCollector = []
routesCollector = []
statsCollector = OrderedDict()

def churnJsons(foldername):
    global stopsCollector
    global routesCollector
    for root, subdirs, files in os.walk(foldername):
        logmessage('\n',root)
        files = [x for x in files if x.endswith('.json')]
        files.sort() # always sort!
        logmessage(files)

        # finding depot - this changes after rationalization on 8.1.19, note.
        # change : take the last folder in the line.
        folderDepotHolder = root.split('/')
        folderDepot = folderDepotHolder[-1]
        logmessage('folderDepot:', folderDepot)
        
        folder = root[len(foldername)+1:]
        # 3.2.19 : intervention : skip the depot folder AAA - it has fake route file unmapped.json which is an output of this reports generation. It should not be taken as input.. wait! bulk mapping depends on.. stops_mapped.csv . If we skip the unmapped.json entirely, then bulk mapping of the remainers will never happen! XOXO
        # 17.2.19 : leave it!
        
        if folder == 'AAA' : continue
        # if folder not in ['RN1','MI2'] : continue # development

        for fileName in files:
            data = json.load(open(os.path.join(root,fileName),'r'), object_pairs_hook=OrderedDict)
            routeRow = OrderedDict()
            points = []
            
            routeRow['workStatus'] = 'working' if foldername == routesFolder else 'locked'
            routeRow['folder'] = folder
            routeRow['jsonFile'] = fileName
            routeRow['depot'] = folderDepot
            routeRow['routeName'] = data.get('routeName','')
            routeRow['routeLongName'] = data.get('routeLongName','')
            routeRow['busType'] = data.get('busType','')
            routeRow['extra0'] = data.get('extra0','')
            routeRow['extra1'] = data.get('extra1','')
            

            # Loop over each direction
            for direction_id in ['0','1']:

                # per-direction timings data copy over
                timeDict = data.get('timeStructure_{}'.format(direction_id),{})
                routeRow['t{}.trip_times'.format(direction_id)] = ','.join( timeDict.get('trip_times',[]) )
                routeRow['t{}.first_trip_start'.format(direction_id)] = timeDict.get('first_trip_start','')
                routeRow['t{}.last_trip_start'.format(direction_id)] = timeDict.get('last_trip_start','')
                routeRow['t{}.frequency'.format(direction_id)] = str(timeDict.get('frequency',''))
                # 4.10.19 intervention: if frequency is just zero, blank it
                if routeRow['t{}.frequency'.format(direction_id)]=='0': routeRow['t{}.frequency'.format(direction_id)]=''
                routeRow['t{}.duration'.format(direction_id)] = str(timeDict.get('duration',''))

                # stops:
                count=0
                for stopRow in data.get('stopsArray{}'.format(direction_id),[]):
                    # first, the route-level info which is same for all stops but we're doing it in this loop anyways so we start the row dict fresh each time and don't carry something over from the last iteration.
                    row = OrderedDict()

                    row['workStatus'] = 'working' if foldername == routesFolder else 'locked'
                    row['folder'] = folder
                    row['jsonFile'] = fileName

                    row['depot'] = folderDepot # override if any
                    row['routeName'] = routeRow['routeName']
                    row['direction_id'] = direction_id
                    count+=1
                    row['stop_sequence'] = count
                    row.update(stopRow) # name, lat, long, confidence, suggested
                    
                    # 8.5.19: intervention: nix the suggestions
                    row.pop('suggested',None)

                    # 30.5.19 : intervention : make confidence string only
                    if row.get('confidence',False): row['confidence'] = str(row.get('confidence',''))
                    
                    stopsCollector.append(row.copy())

                    try:
                        lat = float(stopRow.get('stop_lat',0))
                        lon = float(stopRow.get('stop_lon',0))
                        if lat and lon:
                            points.append([ lat,lon ])
                    except ValueError as e:
                        pass

            # hull computation
            # from _find link!_
            # from https://stackoverflow.com/a/45734111/4355695
            if len(points) > 2:
                hull = np.array(convex_hull(np.array(points)))
                routeRow['hull'] = 0
                if len(hull) >= 4:
                    # 26.2.19:
                    # Polygon calculation happens when the LinearRing supplied is of length >=4. Else it throws up an error. 
                    # A LinerRing has last point same as first point, which the hull func takes care of. 
                    # So if the hull variable is <= 3 points, it means there's only 2 points net, that makes a line, not a polygon.
                    routeRow['hull'] = round( Polygon(hull).area * 10000 ,2)
            else:
                routeRow['hull'] = np.NaN
            
            # 27.6.19 Service numbers
            routeRow['service'] = ','.join(data.get('serviceNumbers',[]))
            
            # 3.8.19 Starting and ending stops in UP direction
            if len(data.get('stopsArray0',[])):
                routeRow['from'] = data.get('stopsArray0',[])[0]['stop_name']
                routeRow['to'] = data.get('stopsArray0',[])[-1]['stop_name']

            logmessage(root,fileName)
            routesCollector.append(routeRow.copy())
            
        # end of direction loop
    # end of working / locked folder loop
# end of function, now actually execute it:

# stopsCollector = []
# routesCollector = []
churnJsons(routesFolder)
churnJsons(lockFolder)

times.append(time.time())
logmessage("Scanning all routes took {} seconds.".format(round(times[-1]-times[-2],2)))

df = pd.DataFrame(stopsCollector, dtype=str).fillna('')

# prep work on the all stops table
df['zap'] = df['stop_name'].apply(zapper)

# routePath:
df['routePath'] = df.apply(lambda y: '{}/{}'.format(y['folder'],y['jsonFile']), axis=1 )

# force lat,lon to floats: # NAAAAH!
# df['stop_lat'] = pd.to_numeric(df['stop_lat'], errors='coerce')
# df['stop_lon'] = pd.to_numeric(df['stop_lon'], errors='coerce')

# lat and lon cols : get rid of all chars that aren't a number, . or -
if 'stop_lat' in df:
    df.stop_lat = df.stop_lat.apply(lambda x: ''.join([c for c in x if c in '1234567890.-']))
else:
    df['stop_lat'] = ''
if 'stop_lon' in df:
    df.stop_lon = df.stop_lon.apply(lambda x: ''.join([c for c in x if c in '1234567890.-']))
else:
    df['stop_lon'] = ''
    
# addendum : do for confidence as well, integers only
if 'confidence' in df:
    df.confidence = df.confidence.apply(lambda x: ''.join([c for c in x if c in '1234567890']))

# put out all stops, but leave out the extra route-specific columns.

stopCols = ['workStatus', 'folder', 'jsonFile', 'depot', 'routeName', 'direction_id', \
    'stop_sequence', 'stop_name', 'stop_lat', 'stop_lon', \
    'zap', 'confidence', 'stop_desc']

df.to_csv(os.path.join(reportsFolder,'stops_all.csv'), index_label='sr', columns=stopCols)
logmessage('Created stops_all.csv, {} entries.'.format( len(df) ))
statsCollector['stops_all'] = len(df)

######
# Unique stops list
# 15.2.19 : to do : use groupby, and get the number of routes etc per stop
uniqueStopsDF = df['stop_name'].drop_duplicates().sort_values().copy().reset_index(drop=True)
uniqueStopsDF.to_csv(os.path.join(reportsFolder,'uniqueStops.csv'), header='stop_name', index_label='sr')
logmessage('Created uniqueStops.csv, {} names.'.format( len(uniqueStopsDF) ))
statsCollector['stops_all_unique'] = len(uniqueStopsDF)

# 25.4.19 : do a unique list of ALL the stops as well for the Stops Reconilliation page.
df['latlon'] = df.apply(lambda y: "{},{}".format(y['stop_lat'],y['stop_lon']), axis=1)

def groupEmALL(x):
    oneStop = OrderedDict({
        'stop_name': listORone(x['stop_name']),
        'count': len(x),
        'routes' : listORone(x['routePath']),
        'num_routes' : len(x['routePath'].unique()),
        'depots': listORone(x['depot']),
        'num_depots': len(x['depot'].unique()),
        'num_locations': len(x['latlon'].unique()),
    })
    return pd.Series(oneStop)

uniqueDF = df.groupby(['zap']).apply(groupEmALL).reset_index()
uniqueDF.to_csv(os.path.join(reportsFolder,'stops_all_unique.csv'), index_label='sr')
logmessage('Created stops_all_unique.csv, {} entries.'.format( len(uniqueDF) )) # note: this is by name and not by lat-longs.

#### 
# manually mapped stops
mappedDF = df[ ( ~df['stop_lat'].isin([np.NaN,'']) ) & ( ~df['confidence'].isin(['0',0])) ].copy().reset_index(drop=True)
# note: np.NaN may not be needed if we have guaranteed it's either float-in-str or nothing
mappedDF.to_csv(os.path.join(reportsFolder,'stops_mapped.csv'), index_label='sr', columns=stopCols )
logmessage('Manually mapped stops:')
logmessage('Created stops_mapped.csv (including all reconciled stops), {} entries.'.format( len(mappedDF) ))
statsCollector['stops_mapped'] = len(mappedDF)

# 30.5.19: Lot of redundance repeats in stops_mapped.csv thanks to reconciliation. To keep the databank etc loading light, let's drop the repeaters (those with same name, lat and long) 
mapped_norepeatsDF = mappedDF.drop_duplicates(['zap','stop_lat','stop_lon']).copy().reset_index(drop=True)
mapped_norepeatsDF.to_csv(os.path.join(reportsFolder,'stops_mapped_databank.csv'), index_label='sr', columns=stopCols )
logmessage('Created stops_mapped_databank.csv (removing repeats by name+lat+long), {} entries.'.format( len(mapped_norepeatsDF) ))
statsCollector['stops_mapped_norepeat'] = len(mapped_norepeatsDF)
# note: this is different from stops_mapped_unique: while that is only unique by name, this is unique by name + location

# prep-work before grouping func: assemble lat-longs in the way needed for convex hull calculation
mappedDF['latlon'] = mappedDF.apply(lambda y: [ float(y['stop_lat'] ),float(y['stop_lon']) ], axis=1)
for N in range(len(mappedDF)):
    try:
        lat = round(float(mappedDF.at[N,'stop_lat']),5)
        lon = round(float(mappedDF.at[N,'stop_lon']),5)
        mappedDF.at[N,'latlon'] = [lat,lon]
    except:
        mappedDF.at[N,'latlon'] = []

# unique mapped stops
depotsList = mappedDF['depot'].unique().tolist()
# 16.2.19: use groupby instead of dropping dupes
def groupUniqueMapped(x):

    #locations, convex hull:
    # 'latlon' column already created prior, it has lat-longs in [x,y] format.
    locations = []
    for location in x['latlon']:
        if (location not in locations) and len(location)==2:
            locations.append(location) 
            # doing uniques-finding this way, because we can't do regular .unique() with a pd series of lists/arrays.
    
    if len(locations) > 2:
        # calc hull only if more than 3 locations are there.
        hull = np.array(convex_hull(np.array(locations)))
        hullArea = 0
        if len(hull) >= 4:
            # 26.2.19:
            # Polygon calculation happens when the LinearRing supplied is of length >=4. Else it throws up an error. 
            # A LinerRing has last point same as first point, which the hull func takes care of. 
            # So if the hull variable is <= 3 points, it means there's only 2 points net, that makes a line, not a polygon.
            hullArea = round( Polygon(hull).area * 10000 ,2)
        '''
        try:
            hullArea = round( Polygon( np.array( convex_hull( np.array(locations) ) ) ).area * 10000 ,2)
        except:
            hullArea = np.NaN
        '''
    else: hullArea = np.NaN
    
    # confidence:
    x['confidence'] = x['confidence'].apply( lambda x: float(x) if x else 0) # now this is safe because confidende column go stripped off of all non-integer chars earlier
    confList = x['confidence'].tolist()
    if len(confList):
        meanConfidence = str( round( statistics.mean( confList ) ,1) )
    else:
        meanConfidence = ''
    
    oneStop = OrderedDict({
        'stop_name': listORone(x['stop_name']),
        'count': len(x),
        'hull': hullArea,
        'routes' : listORone(x['routePath']),
        'depots': listORone(x['depot']),
        'locations': locations,
        'num_routes' : len(x['routePath'].unique()),
        'num_depots': len(x['depot'].unique()),
        'num_locations': len(locations),
        'avgConfidence' : meanConfidence
    })
    # depotwise counts
    for depot in depotsList:
        oneStop[depot] = len(x[x['depot']==depot])
        
    # 16.2.19 : learning : we can't vary the structure (like: which depots) inside a groupby. Else things go *bad*. So, need a fixed list of keys / columns. So, depotsList was formed before grouping, from the full file.
    return pd.Series(oneStop)

# applying groupby function
uniqueMappedDF = mappedDF.groupby(['zap']).apply(groupUniqueMapped).reset_index()

# ensure hull column is numeric
uniqueMappedDF['hull'] = pd.to_numeric(uniqueMappedDF['hull'], errors='coerce')

uniqueMappedDF.to_csv(os.path.join(reportsFolder,'stops_mapped_unique.csv'), index_label='sr')
logmessage('Created stops_mapped_unique.csv, {} entries.'.format( len(uniqueMappedDF) ))
statsCollector['stops_mapped_unique'] = len(uniqueMappedDF)

######
# unmapped stops
logmessage('Unmapped stops:')
unmappedDF = df[ df['stop_lat'].isin([np.NaN,'']) ].copy().reset_index(drop=True)
unmappedDF.to_csv(os.path.join(reportsFolder,'stops_unmapped.csv'), index_label='sr', columns=stopCols)
logmessage('Created stops_unmapped.csv, {} entries.'.format( len(unmappedDF) ))
statsCollector['stops_unmapped'] = len(unmappedDF)

# unique unmapped stops
def group_UnMapped(x):
    oneStop = OrderedDict({
        'stop_name': listORone(x['stop_name']),
        'count': len(x),
        'routes' : listORone(x['routePath']),
        'num_routes' : len(x['routePath'].unique()),
        'depots': listORone(x['depot']),
        'num_depots': len(x['depot'].unique())
    })
    return pd.Series(oneStop)

unmappedUniqueDF = unmappedDF.groupby('zap').apply(group_UnMapped).reset_index()
# unmappedUniqueDF = unmappedDF.drop_duplicates('stop_name').copy().reset_index(drop=True) # now doing grouping

unmappedUniqueDF.to_csv(os.path.join(reportsFolder,'stops_unmapped_unique.csv'), index_label='sr')
logmessage('Created stops_unmapped_unique.csv, {} entries.'.format( len(unmappedUniqueDF) ))
statsCollector['stops_unmapped_unique'] = len(unmappedUniqueDF)


######
# auto mapped stops
logmessage('Automapped stops:')
autoDF = df[ ( ~df['stop_lat'].isin([np.NaN,'']) ) & ( df['confidence'].isin(['0',0])) ].copy().reset_index(drop=True)
autoDF.to_csv(os.path.join(reportsFolder,'stops_automapped.csv'), index_label='sr', columns=stopCols )
logmessage('Created stops_automapped.csv, {} entries.'.format( len(autoDF) ))
statsCollector['stops_automapped'] = len(autoDF)

# unique auto mapped stops
uniqueAutoDF = autoDF.drop_duplicates('stop_name').copy().reset_index(drop=True)
uniqueAutoDF.to_csv(os.path.join(reportsFolder,'stops_automapped_unique.csv'), index_label='sr', columns=stopCols)
logmessage('Created stops_automapped_unique.csv, {} entries.'.format( len(uniqueAutoDF) ))
statsCollector['stops_automapped_unique'] = len(uniqueAutoDF)

times.append(time.time())
logmessage("Stops work took {} seconds.".format(round(times[-1]-times[-2],2)))

##############################################
# get unique locations, unique manually mapped locations
# locations_manual
# locations_automapped : if this is more then it means stops reconcilliation has happened and re-auto-mapping is due.
locations_manualDF = mappedDF.drop_duplicates(['stop_lat','stop_lon']).copy().reset_index(drop=True)
locations_manualDF.to_csv(os.path.join(reportsFolder,'locations_manual.csv'), index_label='sr', columns=stopCols)
logmessage('Created locations_manual.csv, {} entries.'.format( len(locations_manualDF) ))
statsCollector['locations_manual'] = len(locations_manualDF)

locations_autoDF = autoDF.drop_duplicates(['stop_lat','stop_lon']).copy().reset_index(drop=True)
locations_autoDF.to_csv(os.path.join(reportsFolder,'locations_auto.csv'), index_label='sr', columns=stopCols)
logmessage('Created locations_auto.csv, {} entries.'.format( len(locations_autoDF) ))
statsCollector['locations_auto'] = len(locations_autoDF)

# 4.8.19 : New location report reqd for frontend stops map page:
# ALL stops, unique'd by location. but ALL. and carry routes info
df['depot::route'] = df.apply(lambda y: '{}::{}'.format(y['depot'],y['routeName']), axis=1 )
def group_stops_location(x):
    oneStop = OrderedDict({
        'stop_name': listORone(x['stop_name']),
        'count': len(x),
        'routes' : listORone(x['depot::route']),
        'num_routes' : len(x['depot::route'].unique()),
        'num_depots': len(x['depot'].unique())
    })
    return pd.Series(oneStop)
locations_allDF = df.groupby(['stop_lat','stop_lon']).apply(group_stops_location).reset_index().sort_values(['stop_name','num_routes'], ascending=[True,False]).copy().reset_index(drop=True)
cols_locations_all = ['stop_name','stop_lat','stop_lon','count','num_routes','num_depots','routes']
locations_allDF.to_csv(os.path.join(reportsFolder,'locations_all.csv'), index_label='sr', columns=cols_locations_all)
logmessage('Created locations_all.csv, {} entries.'.format( len(locations_allDF) ))

times.append(time.time())
logmessage("Location-level work took {} seconds.".format(round(times[-1]-times[-2],2)))

#######################################
# Next Level : Condense to route-wise rows
# Na, we just assign vals to the columns

routesDF = pd.DataFrame(routesCollector, dtype=str).fillna('')
# intervention: got to set hull value to float again
routesDF['hull'] = pd.to_numeric(routesDF['hull'], errors='coerce') 
# from http://pandas.pydata.org/pandas-docs/stable/reference/api/pandas.to_numeric.html

for n,routeRow in routesDF.iterrows():
    '''
    routeRow['jsonFile']
    '''
    x = df[(df['folder']==routeRow['folder']) & (df['jsonFile']==routeRow['jsonFile'])].copy().reset_index(drop=True)
    dir0df = x[x['direction_id']=='0']
    dir1df = x[x['direction_id']=='1']
    
    dir0dfMapped = dir0df[~dir0df.stop_lat.isin([np.NaN,'',0])].copy().reset_index(drop=True)
    dir1dfMapped = dir1df[~dir1df.stop_lat.isin([np.NaN,'',0])].copy().reset_index(drop=True)

    dir0dfMapped['confidence'] = dir0dfMapped['confidence'].apply( lambda x: float(x) if x else 0)
    dir1dfMapped['confidence'] = dir1dfMapped['confidence'].apply( lambda x: float(x) if x else 0)

    confList = dir0dfMapped['confidence'].tolist() + dir1dfMapped['confidence'].tolist()
    
    if len(confList):
        meanConfidence = str( round( statistics.mean( confList ) *10)/10)
    else:
        meanConfidence = ''

    routesDF.at[n,'len'] = len(x)
    routesDF.at[n,'len0'] = len(dir0df)
    routesDF.at[n,'mapped0'] = len(dir0dfMapped)
    routesDF.at[n,'len1'] = len(dir1df)
    routesDF.at[n,'mapped1'] = len(dir1dfMapped)
    routesDF.at[n,'autoMapped'] = len( x[x['confidence'].isin(['0',0])] )
    routesDF.at[n,'avgConfidence'] = meanConfidence


# % calculations, can be done at full array level
routesDF['mapped%0'] = round( routesDF['mapped0']/routesDF['len0']*100, 1)
routesDF['mapped%1'] = round( routesDF['mapped1']/routesDF['len1']*100, 1)
routesDF['mapped%total'] = round( (routesDF['mapped0'] + routesDF['mapped1'])/routesDF['len']*100, 1)
routesDF['autoMapped%'] = round( routesDF['autoMapped']/routesDF['len']*100, 1)
routesDF['manuallyMapped%'] = round( (routesDF['mapped%total'] - routesDF['autoMapped%']), 1)

routesDF.to_csv(os.path.join(reportsFolder,'routes.csv'), index_label='sr')
logmessage('Created routes.csv, {} entries.'.format( len(routesDF) ))
statsCollector['routes'] = len(routesDF)

# locked routes
dfLocked = routesDF[routesDF['workStatus'] == 'locked'].copy().reset_index(drop=True)

dfLocked.to_csv(os.path.join(reportsFolder,'routes_locked.csv'), index_label='sr')
logmessage('Created routes_locked.csv, {} entries.'.format( len(dfLocked) ))
statsCollector['routes_locked'] = len(dfLocked)

# Q: Which working routes have had some mapping done, and what is the extent of that mapping?

# dfWorking = routesDF[routesDF.workStatus== 'working'].copy().sort_values(['hull','jsonFile'], ascending=[False,True]).reset_index(drop=True)
dfWorking = routesDF[routesDF.workStatus== 'working'].copy().sort_values(['folder','jsonFile'], ascending=[True,True]).reset_index(drop=True)

dfWorking.to_csv(os.path.join(reportsFolder,'routes_inprogress.csv'), index_label='sr')
logmessage('Created routes_inprogress.csv, {} entries.'.format( len(dfWorking) ))
statsCollector['routes_inprogress'] = len(dfWorking)

times.append(time.time())
logmessage("Routes work took {} seconds.".format(round(times[-1]-times[-2],2)))

#########
# get averages, medians etc

statsCollector['averages'] = OrderedDict()
statsCollector['averages']['mapped_median'] = dfWorking['mapped%total'].median()
statsCollector['averages']['mapped_average'] = round( dfWorking['mapped%total'].mean(),2 )

statsCollector['averages']['autoMapped_median'] = dfWorking['autoMapped%'].median()
statsCollector['averages']['autoMapped_average'] = round( dfWorking['autoMapped%'].mean(),2 )

statsCollector['averages']['manualMapped_median'] = dfWorking['manuallyMapped%'].median()
statsCollector['averages']['manualMapped_average'] = round( dfWorking['manuallyMapped%'].mean(),2 )


statsCollector['averages']['stops_hull_median'] = round( uniqueMappedDF['hull'].median(),2 )
statsCollector['averages']['stops_hull_average'] = round( uniqueMappedDF['hull'].mean(),2 )

statsCollector['averages']['routes_hull_median'] = round( routesDF['hull'].median(),2 )
statsCollector['averages']['routes_hull_average'] = round( routesDF['hull'].mean(),2 )

#############
# historical record in stats collector : every 6th hour
# load the stats.json file
try:
    statsDict = json.load(open(os.path.join(reportsFolder,'stats.json')), object_pairs_hook=OrderedDict)
except Exception as e:
    statsDict = OrderedDict()

if not statsDict.get('history',False): 
    statsDict['history'] = {}
currentHour = int ( (datetime.datetime.utcnow() + datetime.timedelta(hours=5.5)).strftime('%H') )
hourStamp = (datetime.datetime.utcnow() + datetime.timedelta(hours=5.5)).strftime('%Y%m%d%H')

if currentHour % 6 == 2:
    statsDict['history'][hourStamp] = statsCollector.copy()

statsDict.update(statsCollector)
# write the stats to file
json.dump(statsDict, open(os.path.join(reportsFolder,'stats.json'), 'w'), indent=2)
logmessage('Created stats.json')

# also: make a CSV of the history
# pd.DataFrame.from_dict(statsDict['history'],orient='index').to_csv(os.path.join(reportsFolder,'stats.csv'),index_label='timestamp')
# 18.5.19 Long-overdue conversion to flat csv
statsCollector = []
for dateH in statsDict['history'].keys():
    row = OrderedDict({'dateH': int(dateH)})
    row.update(statsDict['history'][dateH])
    if 'averages' in statsDict['history'][dateH].keys():
        row.pop('averages',None) # get rid of averages dict and directly add its keys
        row.update(statsDict['history'][dateH]['averages'])
    statsCollector.append(row.copy())
statsDF = pd.DataFrame(statsCollector).sort_values('dateH').reset_index(drop=True)
statsDF.to_csv(os.path.join(reportsFolder,'stats.csv'), index=False)
logmessage('Created stats.csv')

times.append(time.time())
logmessage("Stats work took {} seconds.".format(round(times[-1]-times[-2],2)))

##########################

# 6.4.19 : Generate shapefiles, one per depot/folder

# filter all stops df to have mapped stops - both 
locDF = df[ ~df['stop_lat'].isin([np.NaN,'']) ].copy().reset_index(drop=True)
logmessage("Generating shapefiles, one per depot/folder. Total mapped (manual+auto) stops: {}".format(len(locDF)))

# make the lat, lon columns numeric
locDF['stop_lat'] = pd.to_numeric(locDF['stop_lat'], errors='coerce')
locDF['stop_lon'] = pd.to_numeric(locDF['stop_lon'], errors='coerce')

# pre-work : make a tuple column of lat-longs
# note: geojson stores as long then lat
locDF['couple'] = locDF.apply(lambda x: (x['stop_lon'],x['stop_lat']), axis=1)
locDF.head()

# Now, flatten the stops-wise table to path-wise. one path is (folder + jsonFile + direction_id)
def flattenRoutes(x):
    # this will be called by groupby. To do: collapse the locations to a MultiLineString
    # as per https://python-geojson.readthedocs.io/en/latest/#multilinestring
    a = OrderedDict({
        'path': geojson.LineString(x.couple.tolist()),
        'num_stops': len(x),
        # lets include stop names too.
        'stop_names': '|'.join(x.stop_name.tolist())
    })
    return pd.Series(a)
pathDF = locDF.groupby(['folder','jsonFile','direction_id']).apply(flattenRoutes).reset_index()

# Create a new column "feature" and make a geojson feature out of the "path", with the other columns brought in as feature properties
pathDF['feature'] = pathDF.apply(lambda x: geojson.Feature(geometry=x['path'], \
    properties={'folder':x.folder, 'jsonFile':x.jsonFile, 'direction_id':x.direction_id, \
    'num_stops':x.num_stops, 'stop_names':x.stop_names}), axis=1)

# get list of depots / folders and loop through them
depotList = pathDF.folder.unique()
depotList.sort() # sort it!

for folder in depotList:
    features = pathDF[pathDF.folder==folder]['feature'].tolist()
    depotShape = geojson.FeatureCollection(features)
    geojson.dump(depotShape, open(os.path.join(shapesFolder,"{}.geojson".format(folder)), 'w'), indent=2)
    logmessage('Created {}.geojson with {} lines.'.format(folder,len(features)))

times.append(time.time())
logmessage("Shapefiles work took {} seconds.".format(round(times[-1]-times[-2],2)))

##########################

times.append(time.time())
logmessage("{}: Full reports creation script took {} seconds.".format(hourStamp,round(times[-1]-times[0],2)))

##########################
# COMMON FUNCTIONS


##########################
# CODE GRAVEYARD
'''

def backup(filepath):
    # make timestamp for backup string
    backupSuffix = '_{:%Y%m%d-%H%M%S}'.format(datetime.datetime.utcnow() + datetime.timedelta(hours=5.5))
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

'''
