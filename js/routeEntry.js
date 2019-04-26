/* main.js */

//#####################################
/* constants */
//const APIpath = 'API/';
const waitTime = 300;

//#####################################
/* global variables */
var stops0 = ace.edit("stops0");
var stops1 = ace.edit("stops1");
var globalChangesDone = false;
var showHints = true;
var statusTimer; // clear out any previous timer in the status messages. from https://stackoverflow.com/a/3015351/4355695

var globalRoute = '';
var URLParams = {}; // for holding URL parameters
//#####################################
// On page load
$(document).ready(function() {
	$.ajaxSetup({ cache: false }); // from https://stackoverflow.com/a/13679534/4355695 to force ajax to always load from source, don't use browser cache. This prevents browser from loading old route jsons.

	// bootstrap popover
	$('[data-toggle="popover"]').popover();
	$('[data-toggle="tooltip"]').tooltip();
	
//	loadRoutesList();
	loadJsonsList();
	// drowndown handlers:

	//ACE editor : listen for changes
	stops0.session.on('change', function(delta) {
		globalChangesDone = true;
	});

	stops1.session.on('change', function(delta) {
		globalChangesDone = true;
	});

	/*
	$('#routeSelect').on('change', function (e) {
		var valueSelected = this.value;
		console.log(valueSelected);
		if( valueSelected == '') { 
			return;
		}
		loadRoute(valueSelected);
	});
	*/

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
		loadJson(globalRoute);
	});

	// Clone routeName to routeFileName
	$("#routeName").bind("change keyup", function(){
		$("#routeName").val( this.value.toUpperCase() );
		$("#routeFileName").val( this.value.replace(/[^A-Za-z0-9-_]/g, "_") );
	});

	// Automatically turn hints off after this many seconds, if they're still on.
	setTimeout(function() { if(showHints) toggleHints(); }, 5*1000);

	/*
	// suppress browser from scrolling to top
	// from https://stackoverflow.com/questions/1601933/how-do-i-stop-a-web-page-from-scrolling-to-the-top-when-a-link-is-clicked-that-t
	$('a').click(function(e) {
		//doSomething();
		return false;
	});
	*/
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
		loadJson(globalRoute);
		$('#jsonSelect').val(globalRoute);
		$('#jsonSelect').trigger('chosen:updated');
	}

});

//#####################################
// API Call functions



function saveRoute() {
	
	var data = {};
	data.routeFileName = document.getElementById('routeFileName').value + '.json';
	data.depot = document.getElementById('depot').value;
	if(data.routeFileName == '' || data.depot == '') {
		alert('Error: Please put a proper filename and depot code for the route, in green box right side.');
		$('.saveStatus').html('Invalid filename given.');
		clearTimeout(statusTimer);
		statusTimer = setTimeout(function() { $('.saveStatus').html(''); }, waitTime/5*1000);
		return;
	}
	var route_id = `${data.depot}/${data.routeFileName}`;
	if( globalRoute.length && route_id != globalRoute) {
		if(! confirm(`Note: this is a new route(${route_id}) from what was previously loaded (${globalRoute}). Are you sure you want to proceed?`))
			return;
	}
	globalRoute = route_id;
	$('.saveStatus').html(`<b>Saving to routes/${globalRoute} ...</b>`);

	// lets get it all together!
	// route-meta:
	data.routeName = document.getElementById('routeName').value;
	data.routeLongName = document.getElementById('routeLongName').value;
	data.busType = document.getElementById('busType').value;
	// stops:
	data.stops0 = stops0.getValue();
	data.stops1 = stops1.getValue();
	// timings:
	//data.timings0 = document.getElementById('timings0').value;
	//data.timings1 = document.getElementById('timings1').value;
	//data.timingsWeekend0 = document.getElementById('timingsWeekend0').value;
	//data.timingsWeekend1 = document.getElementById('timingsWeekend1').value;
	// frequency:
	//data.freq0 = document.getElementById('freq0').value;
	//data.freq1 = document.getElementById('freq1').value;
	// extra:
	data.extra0 = document.getElementById('extra0').value;
	data.extra1 = document.getElementById('extra1').value;
	
	console.log(data);

	request = $.ajax({
		url: `${APIpath}routeEntry?route=${globalRoute}&key=${globalApiKey}`,
		type: "post",
		data: JSON.stringify(data),
		success: function(result){
			console.log('saveRoute POST call successful.');
			//console.log('result:',result);
			globalChangesDone = false;
			loadJsonsList();
			
			setTimeout(function() { 
				// Just for psychological satisfaction, even when all is done, wait a second before clearing out and telling user that all is saved.
				$('.saveStatus').html(`<b>${result}</b>`);
				clearTimeout(statusTimer);
				statusTimer = setTimeout(function() { $('.saveStatus').html(''); }, waitTime*1000);
			}, 1*1000);
			
		},
		error: function(jqXHR, exception) {
			console.log( jqXHR.responseText );
			$('.saveStatus').html(`${jqXHR.responseText}`);
		}
	});
	
}

function loadJsonsList() {
    $.get( `${APIpath}loadJsonsList`, function( data ) {
        console.log('GET request loadJsonsList successful.');
        $('#jsonSelect').html(data);
        $('#jsonSelect').trigger('chosen:updated'); 
        $('#jsonSelect').chosen({disable_search_threshold: 1, search_contains:true, width:200, placeholder_text_single:'Pick a route'});
	});
}

function loadJson(route_id) {
	if(route_id == '') return;

	clearEverything(loaderText='loading...');
	console.log('loadJson:',route_id)
	
	//$('#routeName').val('loading..');
	/*
	$.get( `${APIpath}loadJson?route=${route_id}`, function( data ) {
		console.log('loadJson GET call successful for',route_id);
		jsondata = JSON.parse(data);
		//console.log(jsondata);
	*/
	$.getJSON(`routes/${route_id}`, function(jsondata) {
		clearEverything();

		$('#routeName').val(jsondata['routeName']);
		$('#routeLongName').val(jsondata['routeLongName']);
		//$('#depot').val(jsondata['depot']);
		// nah, lets just be honest and load the folder name
		$('#routeFileName').val(route_id.split('/')[1].replace('.json',''));
		$('#depot').val(route_id.split('/')[0]);
		
		$('#busType').val(jsondata['busType']);
		$('#extra0').val(jsondata['extra0']);
		$('#extra1').val(jsondata['extra1']);

		//$('#timings0').val(jsondata['timings0']);
		//$('#timings1').val(jsondata['timings1']);
		//$('#timingsWeekend0').val(jsondata['timingsWeekend0']);
		//$('#timingsWeekend1').val(jsondata['timingsWeekend1']);
		//$('#freq0').val(jsondata['freq0']);
		//$('#freq1').val(jsondata['freq1']);

		// 8.12.18: Intervention : Check if stopsArray keys are present and having length:
		if( jsondata['stopsArray0'] instanceof Array) {
			var stopsText = '';
			jsondata['stopsArray0'].forEach( function(x) {
				stopsText += x['stop_name'];
				if( x['stop_lat']) stopsText += '|' + x['stop_lat'];
				if( x['stop_lon']) stopsText += '|' + x['stop_lon'];
				if( x['confidence']) stopsText += '|' + x['confidence'];
				if( x['stop_id']) stopsText += '|' + x['stop_id'];
				stopsText += '\n';
			});
			stops0.setValue(stopsText);
			console.log('loaded stops from json array instead of string');
		}
		else {
			if(jsondata['stops0'])
				stops0.setValue(jsondata['stops0']);
		}
		
		if( jsondata['stopsArray1'] instanceof Array) {
			var stopsText = '';
			jsondata['stopsArray1'].forEach( function(x) {
				stopsText += x['stop_name'];
				if( x['stop_lat']) stopsText += '|' + x['stop_lat'];
				if( x['stop_lon']) stopsText += '|' + x['stop_lon'];
				if( x['confidence']) stopsText += '|' + x['confidence'];
				if( x['stop_id']) stopsText += '|' + x['stop_id'];
				stopsText += '\n';
			});
			stops1.setValue(stopsText);
		}
		else {
			if(jsondata['stops1'])
				stops1.setValue(jsondata['stops1']);
		}
		// make the ace editor boxes unselected; by default they're select-all when just loaded.
		stops0.clearSelection();
		stops1.clearSelection();
	});
}
//#####################################
// Other Functions

function toggleHints() {
	if(showHints) {
		// using a brute force all-three-hammers way after using each singly just failed. Only doing 'dispose' caused bad runtime errors on the page to build up. Reference: https://github.com/twbs/bootstrap/issues/475
		$('[data-toggle="popover"]').popover('hide');
		$('[data-toggle="popover"]').popover('disable');
		$('[data-toggle="popover"]').popover('dispose');

		$('[data-toggle="tooltip"]').tooltip('hide');
		$('[data-toggle="tooltip"]').tooltip('disable');
		$('[data-toggle="tooltip"]').tooltip('dispose');

		showHints = false;
		$('#toggleHintsLink').html('Hints: OFF');
	} else {
		$('[data-toggle="popover"]').popover();
		$('[data-toggle="tooltip"]').tooltip();
		showHints = true;
		$('#toggleHintsLink').html('Hints: ON');
	}
}

function reverse() {
	let sequence = stops0.getValue().split('\n');
	sequence.reverse();
	stops1.setValue(sequence.join('\n'));
	stops1.clearSelection();
}

function clearEverything(loaderText='') {
	$(':input').val(loaderText);
	stops0.setValue(loaderText);
	stops1.setValue(loaderText);
	$('.saveStatus').html('');
}

function weekendCopy(dir=0) {
	$('#timingsWeekend'+dir).val($('#timings'+dir).val());
	
}



// ######################################3
// GRAVEYARD

/*
function loadRoutesList() {
	$.get( `${APIpath}loadRoutesList`, function( data ) {
		//console.log(data);
		$('#routeSelect').html(data);
		$('#routeSelect').trigger('chosen:updated'); 
		$('#routeSelect').chosen({disable_search_threshold: 1, search_contains:true, width:200, height: 400, placeholder_text_single:'Pick a route'});
	});
}

function loadRoute(route_id) {
	if(route_id == '') return;

	clearEverything('loading..');
	/*
	document.getElementById('timings0').value = document.getElementById('timings1').value = document.getElementById('routeName').value = 'loading...';
	stops0.setValue('loading...');
	stops1.setValue('loading...');
	*/
/*
	//$('#routeName').val('loading..');
	$.get( `${APIpath}loadRouteCSV?route=${route_id}`, function( data ) {
		console.log('loadRouteCSV GET call successful for',route_id);
		jsondata = JSON.parse(data);
		//console.log(jsondata);

		// just for psychological satisfaction, wait another half a second before setting all the values
		setTimeout(function() { 
			;
		}, 0.5*1000);

		clearEverything();
		
		$('#routeName').val(jsondata['route']);
		$('#routeFileName').val(jsondata['filename'].toUpperCase());

		stops0.setValue(jsondata['stops0']);
		stops0.clearSelection();
		stops1.setValue(jsondata['stops1']);
		stops1.clearSelection();

		$('#timings0').val(jsondata['timings0']);
		$('#timings1').val(jsondata['timings1']);

		/* oh crap this is CSV loading : the only data loading here is : sequence of stops, default timings if any
		$('#timingsWeekend0').val(jsondata['timingsWeekend0']);
		$('#timingsWeekend1').val(jsondata['timingsWeekend1']);
		$('#extra0').val(jsondata['extra0']);
		$('#extra1').val(jsondata['extra1']);
		$('#freq0').val(jsondata['freq0']);
		$('#freq1').val(jsondata['freq1']);
		*/
	/*	

	});
}
*/