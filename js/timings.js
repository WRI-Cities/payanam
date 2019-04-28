/* timings.js 
started on 1.4.19
*/

// ######################################
/* constants */
//const APIpath = 'API/';
const waitTime = 300;

// defaults : moved to common.js

/* GLOBAL VARIABLES */
var URLParams = {}; // for holding URL parameters
var globalRoute = '';
var globalChangesDone = false;

//#####################################
// On page load
$(document).ready(function() {
    $.ajaxSetup({ cache: false }); // from https://stackoverflow.com/a/13679534/4355695 to force ajax to always load from source, don't use browser cache. This prevents browser from loading old route jsons.
    
    loadDefaults();
    loadJsonsList();

    $('#jsonSelect').on('change', function (e) {
		
		if( this.value == '') { 
			return;
		}
		if(globalChangesDone) {
			if(!confirm('Warning: There are unsaved changes on this route which will be lost. Sure you want to proceed?') )
				return;
			else globalChangesDone = false;
		}
		// 1.4.19 : Darn it, had to move it down over here as well. Else globalRoute becomes something else!
		globalRoute = this.value;
		console.log(globalRoute);
		loadJson();
    });
    
    // URL parameters. from https://stackoverflow.com/a/2405540/4355695
    var query = window.location.search.substring(1).split("&");
    for (var i = 0, max = query.length; i < max; i++)
    {
        if (query[i] === "") // check for trailing & with no param
            continue;
        var param = query[i].split("=");
        URLParams[decodeURIComponent(param[0])] = decodeURIComponent(param[1] || "");
        // this gets stored to global json variable URLParams
    }

    // check URLParams if a route is supposed to be loaded
    if(URLParams['route']) {
        console.log('Auto-loading route:',URLParams['route']);
        globalRoute = URLParams['route'];
        loadJson();
        $('#jsonSelect').val(globalRoute);
        $('#jsonSelect').trigger('chosen:updated');
    }

    // load defaults
    loadDefaults();

});

//#####################################
// API Call functions
function loadJsonsList() {
    $.get( `${APIpath}loadJsonsList`, function( data ) {
        console.log('GET request loadJsonsList successful.');
        $('#jsonSelect').html(data);
        $('#jsonSelect').trigger('chosen:updated'); 
        $('#jsonSelect').chosen({disable_search_threshold: 1, search_contains:true, width:200, placeholder_text_single:'Pick a route'});
	});
}

function loadJson() {
	if(globalRoute == '') return;

	clearEverything(loaderText='loading...');
	console.log('loadJson():',globalRoute)

	$.getJSON(`routes/${globalRoute}`, function(data) {
        clearEverything();
        routeParts = globalRoute.split('/');
        $('.routeMeta').html(`Depot:${routeParts[0]} | filename:${routeParts[1]} | Route Name : ${data.routeName}`);
        $('#saveButtonRoute').html(`for ${globalRoute}`);

        // legacy stuff
        if(data['timings0']) $('.onward .trip_times').val(cleanList(data['timings0']).join(', '));
        if(data['timings1']) $('.return .trip_times').val(cleanList(data['timings1']).join(', '));
        if(data['timings0'] || data['timings1']) $('#legacy_warning').html('Note: legacy timings data loaded - this may be inaccurate.');

        var timingsFlag = false; var frequencyFlag = false;

        ['0','1'].forEach(dir => {
            let dirclass = (dir == '0')? '.onward' : '.return';
            if( ! data[`timeStructure_${dir}`]) return;
            var a = data[`timeStructure_${dir}`];

            $('#legacy_warning').html('');
            
            
            if(a['trip_times'].length) {
                $(`${dirclass} .trip_times`).val(a['trip_times'].join(', '));
                timingsFlag = true;
                console.log("says there are timings.");
            }
            if(a[`first_trip_start`]) $(`${dirclass} .first_trip_start`).val(a[`first_trip_start`]);
            if(a[`last_trip_start`]) $(`${dirclass} .last_trip_start`).val(a[`last_trip_start`]);

            // intervention : don't store frequency/headway as hr-min-sec. that's only for the frontend. Store it all as secs only.
            if(a['frequency']) {
                a['hr'] = Math.floor(a['frequency']/3600);
                a['min'] = Math.floor( (a['frequency']%3600)/60 );
                a['sec'] = Math.floor( (a['frequency']%60) );
                ['hr','min','sec'].forEach(tt => {
                    if(a[tt]) $(`${dirclass} .${tt}`).val(a[tt]);
                });
                frequencyFlag = true;
            }
            
            // duration
            if(a['duration']) $(`${dirclass} .duration`).val(cleanTime(a[`duration`]));

        });
        // console.log(data);
        // if frequencies loaded and not times, activate that tab.
        if(frequencyFlag && !timingsFlag) {
            // $( "#tabs" ).tabs({active: 1}); 
            $( "#tabs" ).tabs( "option", "active", 1 );
        }
    });
}

function saveTimings() {
    //globalRoute, globalApiKey
    var data = {};

    ['0','1'].forEach(dir => {
        let dirclass = (dir == '0')? '.onward' : '.return';

        data[`timeStructure_${dir}`] = {};
        let a = data[`timeStructure_${dir}`];
        a['trip_times'] = cleanList($(`${dirclass} .trip_times`).val());
        $(`${dirclass} .trip_times`).val(a[`trip_times`].join(', '));

        // frequency
        a[`first_trip_start`] = cleanTime($(`${dirclass} .first_trip_start`).val());
        $(`${dirclass} .first_trip_start`).val(a[`first_trip_start`]);

        a[`last_trip_start`] = cleanTime($(`${dirclass} .last_trip_start`).val());
        $(`${dirclass} .last_trip_start`).val(a[`last_trip_start`]);

        a['frequency'] = 0;
        ['sec','min','hr'].forEach((tt,i) => {
            let timeval = $(`${dirclass} .${tt}`).val();
            if(timeval) a['frequency'] += parseInt(timeval) * Math.pow(60,i);
        });

        a['duration'] = cleanTime($(`${dirclass} .duration`).val());
        $(`${dirclass} .duration`).val(a[`duration`]);
        
        console.log(a);
        
    });
   
    console.log(data);
    console.log('saveTimings(): filename is:',globalRoute);

    $.ajax({
		url : `${APIpath}timings?route=${globalRoute}&key=${globalApiKey}`,
		type : 'POST',
		data : JSON.stringify(data),
		cache: false,
		processData: false,  // tell jQuery not to process the data
		contentType: false,  // tell jQuery not to set contentType
		success : function(returndata) {
            console.log(returndata);
            $('#saveStatus').html(`<p class="alert alert-success">${returndata}</p>`);
        },
        error: function(jqXHR, exception) {
            $('#saveStatus').html(`<p class="alert alert-danger">${jqXHR.responseText}</p>`);
        }
    });
}

//#####################################
// Functions

function cleanList(timingsHolder) {
    if(!timingsHolder) return [];
    if(!timingsHolder.length) return [];
    // regex to match multiple and even recurring separators and replace with just the | separator
    // from https://stackoverflow.com/a/34936253/4355695
    timingsHolder = timingsHolder.replace(/[\r\n\x0B\x0C\u0085\u2028\u2029\t, |]+/g,"|");
    let trip_times = [];
    for( let part of timingsHolder.split('|')) {
        let cpart = cleanTime(part);    
        if(cpart.length) trip_times.push(cpart);
    }
    return trip_times;
}

function cleanTime(timeStr) {
    // keeping this as a separate function so it can be reused by all
    if(!timeStr.length) return '';
    let clean1 = timeStr.replace(/[^\d:]+/g,"");
    if(clean1.length < 4 || clean1.length > 8) {
        console.log(`"${timeStr}" when cleaned to "${clean1}" is too small or too long to be a valid timing. Discarding it.`);
        clean1 = '';
    }
    return clean1;
}

function frequency_copy() {
    ['first_trip_start','last_trip_start','hr','min','sec'].forEach(tt => {
        $(`.return .${tt}`).val($(`.onward .${tt}`).val());
    });
}


function copyDuration() {
    let cleanDuration = cleanTime($('.onward .duration').val());
    $('.duration').val(cleanDuration);

}

function duration1hr() {
    $('.duration').val('01:00');
}
//#####################################
// Clearing / resetting functions

function clearEverything(loaderText='') {
    $('#legacy_warning').html('');
    $('#saveStatus').html('');
    resetTimings(dontask=true);
    resetFrequency(dontask=true);
}

function resetTimings(dontask=false) {
    if(!dontask) if(!confirm("Are you sure you want to wipe out all timings info entered so far? Both onward and return sides will be erased.")) return;
    $('.trip_times').val('');
   
}

function defaultTimings() {
    if(!confirm("Are you sure you want to load defaults? This will over-write all timings info entered so far for both onward and return.")) return;
    $('.trip_times').val(defaults['timeDefaults']['trip_times']);

}

function resetFrequency(dontask=false) {
    if(!dontask) if(!confirm("Are you sure you want to wipe out all frequency info entered so far? Both onward and return sides will be erased.")) return;
    $('.first_trip_start').val('');
    $('.last_trip_start').val('');
    $('.hr').val('');
    $('.min').val('');
    $('.sec').val('');
}

function defaultFrequency() {
    if(!confirm("Are you sure you want to load defaults? This will over-write all frequency info entered so far for both onward and return.")) return;
    $('.first_trip_start').val(defaults['timeDefaults']['first_trip_start']);
    $('.last_trip_start').val(defaults['timeDefaults']['last_trip_start']);
    $('.hr').val(defaults['timeDefaults']['hr']);
    $('.min').val(defaults['timeDefaults']['min']);
    $('.sec').val(defaults['timeDefaults']['sec']);
}

