'''
gtfs_common.py
by Nikhil VJ
Forked out on 9.4.18
as a one-stop for common functions used in GTFS conversions
'''

from math import sin, cos, sqrt, atan2, radians


# quick lambda function to zap
zapper = lambda x: ''.join(e.lower() for e in str(x) if e.isalnum())


# In[7]:


# sandbox
val = 'werwer232'
val2 = ''.join([c for c in val if c in '1234567890:'])
# print\(val2)

justnum = '620'
# print\([ justnum[:-2], justnum[-2:]])


# In[8]:

def timeFormat(x):
    # getting rid of artefacts: from question itself in https://stackoverflow.com/questions/947776/strip-all-non-numeric-characters-except-for-from-a-string-in-python
    x = ''.join([c for c in x if c in '1234567890:'])
    
    holder1 = x.split(':')
    if len(holder1) < 2:
        # if it's like '1320' then interpret it
        justnum = holder1[0]
        if justnum == '':
            # blank string
            return ''
        if len(justnum) in [3,4]:
            holder1 = [ justnum[:-2], justnum[-2:] ]
            print("Special case: {} becomes {}".format(justnum,holder1))
        else:
            print('{} is an invalid time string. Skipping it.'.format(x))
            # raise ValueError("'{}' is an invalid time string.".format(x))
            return ''
    hh = holder1[0].rjust(2,'0')
    mm = holder1[1].rjust(2,'0')
    if len(holder1) >= 3: ss = holder1[2].rjust(2,'0')
    else: ss = '00'
    return "{}:{}:{}".format(hh,mm,ss)
# test
# print\(timeFormat('3:04'))
# print\(timeFormat('3:7:4'))


# In[9]:


# time calculations

def time2secs(hhmmss):
    hhmmss = hhmmss.replace("'","")
    holder1 = hhmmss.split(':')
    if len(holder1) < 2:
        print('{} is an invalid time string.'.format(hhmmss))
        raise ValueError("'{}' is an invalid time string.".format(hhmmss))
    hh = int(float(holder1[0]))
    mm = int(float(holder1[1]))
    if len(holder1) >= 3: ss = int(float(holder1[2])) # taking precautions for cases like '0.0' - first parse float, then int
    else: ss = 0
    return (hh*3600 + mm*60 + ss)
# test:
# print\( time2secs('12:00:34') )
# print( time2secs('whata') )
# print\( time2secs('00:05:34') )

def secs2time(secs):
    # data cleaning: secs must be int
    secs = int(float(secs))
    hh = str(int(secs/3600)).rjust(2,'0')
    remaining = secs % 3600
    mm = str(int(remaining/60)).rjust(2,'0')
    ss = str(remaining % 60).rjust(2,'0')
    return "{}:{}:{}".format(hh,mm,ss)
# test
# print(secs2time(3453))

def timeDiff(t1,t2,formatted=True):
    diff = time2secs(t2) - time2secs(t1)
    if diff < 0:
        print("Yo time travel man: {} to {}".format(t1,t2))
        diff = 0 - diff
    # convert the diff back into hh:mm:ss format
    if formatted:
        return secs2time(diff)
    else:
        return diff
#test
# print\(timeDiff("5:40","5:45:00"))
# print\(timeDiff("5:45","5:40:00"))
# print\(timeDiff("5:40","5:44:00",formatted=False))


def timeAdd(t1,delta):
    return secs2time( time2secs(t1) + delta)
#test
# print\(timeAdd("6:00",34))


# In[10]:


# function to check if chosen stop_id is unique
def checkUnique(stop_id,stopsArray):
    existingList = [x['stop_id'] for x in stopsArray]
    if stop_id in existingList:
        return False
    else:
        return True


# In[11]:


def timeEngine(first_trip_start,last_trip_start,trip_duration,num_trips):
    # +24h if last time crosses midnight
    if time2secs(last_trip_start) <= time2secs(first_trip_start):
        last_trip_start = timeAdd(last_trip_start,24*60*60)
    
    # if num_trips less than 2, set it to default_tripsPerDay (declared at start of prog)
    if num_trips < 2: num_trips = default_tripsPerDay
    
    spanSecs = timeDiff(first_trip_start,last_trip_start,formatted=False)
    headway = spanSecs/(num_trips-1)
    
    first_trip_end = timeAdd(first_trip_start,time2secs(trip_duration))
    last_trip_end = timeAdd(last_trip_start,time2secs(trip_duration))
    
    tripTimesArray = []
    for n in range(num_trips-1):
        start_time = timeAdd(first_trip_start,round(n*headway) )
        end_time = timeAdd(first_trip_end,round(n*headway) )
        tripTimesArray.append( [start_time,end_time] )
    
    # and add the last trip at end
    tripTimesArray.append( [last_trip_start,last_trip_end] )

    return tripTimesArray.copy()

# test
# print\(timeEngine('06:00','07:00','00:10',10))

# cross midnight?
# print\('crossing midnight example:\n',timeEngine('23:30', '01:10','01:00',5))

def timeEngineFrequency(first_trip_start,last_trip_start,frequency,trip_duration):
    # +24h if last time crosses midnight
    if time2secs(last_trip_start) <= time2secs(first_trip_start):
        last_trip_start = timeAdd(last_trip_start,24*60*60)
    
    headway = frequency
    
    first_trip_end = timeAdd(first_trip_start,time2secs(trip_duration))
    last_trip_end = timeAdd(last_trip_start,time2secs(trip_duration))

    num_trips = timeDiff(first_trip_start,last_trip_start,formatted=False) // headway

    tripTimesArray = []
    for n in range(num_trips):
        start_time = timeAdd(first_trip_start,round(n*headway) )
        end_time = timeAdd(first_trip_end,round(n*headway) )
        tripTimesArray.append( [start_time,end_time] )
    
    # and add the last trip at end
    tripTimesArray.append( [last_trip_start,last_trip_end] )

    return tripTimesArray.copy()

# In[12]:


def tripTimesProcess(timestr):
    timestr2 = timestr.replace(' ','|').replace(',','|')
    holder = [timeFormat(x) for x in timestr2.split('|') if len(x)]
    # print(holder)
    # in case any element in holder is ''
    holder2 = [x for x in holder if len(x)]
    return holder2

# test
tripTimesProcess('05:15,05:50,06:15,06:35,07:55,08:35,09:30,10:05,10:25,11:40,12:35,13:20,14:15,14:40,15:30,16:20,17:05,17:30,18:25,18:45 ,19:10,20:50,21:10,21:45')
tripTimesProcess('')
tripTimesProcess('6:30 , 8:05 , 9:45 , 11:30 , 13:05 , 14:40 , 16:20 , 18:05 , 19:30 , 21:15')


# In[13]:


def timeEngineTrips(tripsArr,trip_duration):
    tripTimesArray = []
    for start_time in tripsArr:
        end_time = timeAdd(start_time,time2secs(trip_duration) )
        tripTimesArray.append( [start_time,end_time] )
    return tripTimesArray

#test
# print\(timeEngineTrips(['06:30:00','08:05:00','23:23:01'],'1:30:00'))


##################
# DISTANCE RELATED

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

    distance = round(R * c, 2)
    return distance

def computeDistance(sequencedf):
    prevLat = prevLon = 0 # dummy initiation
    total_dist = 0
    for N in range(len(sequencedf)):
        lat = float(sequencedf.at[N,'stop_lat'])
        lon = float(sequencedf.at[N,'stop_lon'])
        
        if N == 0:
            sequencedf.at[N,'ll_dist'] = 0
        else:
            sequencedf.at[N,'ll_dist'] = lat_long_dist(lat,lon, prevLat,prevLon)
        
        total_dist += sequencedf.at[N,'ll_dist']
        sequencedf.at[N,'ll_dist_traveled'] = round(total_dist,2)
        prevLat = lat
        prevLon = lon
        
    return round(total_dist,2)
    # even the original sequencedf passed is changed with the ll_dist and ll_dist_traveled columns added, unless a copy was passed in.

def computeDuration(sequencedf, this_speed):
    total_dist = computeDistance(sequencedf)
    duration = secs2time( round(total_dist / this_speed * 3600) ) # get it in hh:mm:ss format
    # hey that total distance is useful too, so let's return both these values
    return duration, total_dist

def computeSpeed(sequencedf, this_duration):
    total_dist = computeDistance(sequencedf)
    speed = round( total_dist / time2secs(this_duration) * 3600 ,1)
    return speed, total_dist

# function to check if chosen stop_id is unique
def checkUnique(stop_id,stopsArray):
    existingList = [x['stop_id'] for x in stopsArray]
    if stop_id in existingList:
        return False
    else:
        return True
