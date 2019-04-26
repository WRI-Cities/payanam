/* routemap.js
moved here from RouteMapper
*/

// ######################################
/* 1. GLOBAL VARIABLES */

// default point colors : MOVED to common.js

const routeTable_height = "400px";
const globalRandom = (new Date).getTime();
console.log(globalRandom);
//const suggestedTabularColor = '#b9e8c3'; // used in tabulator

var globalIndex = '';
var clickedflag = false;
var debugMode = true;
var URLParams = {}; // for holding URL parameters
var firstRunDone = false; // for preventing 3-time calling of mapStops() on startup.
var mappedList = [];
// Map: these layers need to have global scope, and are mentioned in tabulator constructors, hence need to be defined here.
var stopsLayer = new L.geoJson(null);
var databank = new L.geoJson(null);
var lineLayer = new L.geoJson(null);
// initiate GPX layers in advance
var trackLayer = new L.geoJson(null);
var waypointLayer = new L.geoJson(null);
var suggestedLayer = new L.geoJson(null);
var depotsLayer = new L.geoJson(null); // for depots

var globalRoute = '';
var globalChangesDone = false;

// databanks : loading them into global variables
var global_stops_mapped = [];
var global_databank = [];
var global_stops_automapped = [];
var global_postoffice = [];
var global_hamlets = [];
// #################################
/* 2. Initiate tabulators */

// first, define custom functions that will be called by the table
var stopsTotal = function(values, data, calcParams){
	var calc = values.length;
	return calc + ' stops total';
}

//########################
// now the actual table construction


var suggestedTrueFalse = function(cell, formatterParams, onRendered){
	let value = cell.getValue();
	console.log(value);
	if(value) {
		if(value.length)
			return true;
	}
	return false;
};
var routeTable = new Tabulator("#routeTable", {
	height:routeTable_height,
	selectable:1, // make max 1 row click-select-able. https://tabulator.info/docs/3.4?#selectable
	movableRows: true, //enable user movable rows
	//layout:"fitColumns", //fit columns to width of table (optional)
	//index: "orig_id", 
	layout:"fitDataFill",
	addRowPos: "top",
	tooltipsHeader:true,
	/*
	dataTree:true, 
	dataTreeCollapseElement: "<span class='badge badge-secondary'>-</span> ",
	dataTreeExpandElement: "<span class='badge badge-secondary'>+</span> ",
	*/
	columns:[ //Define Table Columns
		{rowHandle:true, formatter:"handle", headerSort:false, frozen:true},
		//{title:"orig_id", field:"orig_id", frozen:true, headerFilter:"input" },
		//{title:"Num", width:40, formatter: "rownum", headerSort:false}, // row numbering
		{title:"seq", field:"stop_sequence", editor:"input", headerFilter:"input", headerTooltip:"stop sequence number", width:15, headerSort:false, frozen:true },
		{title:"stop_name", field:"stop_name", editor:"input", headerFilter:"input", bottomCalc:stopsTotal, width:100, headerSort:false, frozen:true },
		{title:"direction", field:"direction_id", editor:"input", headerFilter:"input", headerTooltip:"direction_id: 0 for onward, 1, for return", width:50, headerSort:false },
		
		{title:"stop_lat", field:"stop_lat", headerSort:false, width:60, headerTooltip:"latitude" },
		{title:"stop_lon", field:"stop_lon", headerSort:false, width:60, headerTooltip:"longitude" },
		{title:"confidence", field:"confidence", headerFilter:"input", width:50, headerSort:false, editor:"select", editorParams:{values: confidence_options} },
		{formatter:unMapIcon, align:"center", title:"unmap", width:20, headerSort:false, headerTooltip:"remove mapping for this stop", cellClick:function(e, cell){
			if(! cell.getRow().getData()['stop_lat']) return;
			
			if(confirm('Are you sure you want to remove lat-long values for this stop?'))
				cell.getRow().update({'stop_lat':'','stop_lon':'', 'confidence':''});
				if(map.hasLayer(lineLayer)) {
					routeLines();
					routeLines();
				}
			}
		},
		{title:"offset", field:"offset", headerFilter:"input", editor:"input", headerTooltip:"arrival time, in mins after first stop", headerSort:false },
		{title:"stop_desc", field:"stop_desc", editor:"input", headerFilter:"input", width:100, headerSort:false },
		{title:"suggested", field:"suggested", width:100, headerSort:false },
		{formatter:"buttonCross", align:"center", title:"del", width:20, headerSort:false, headerTooltip:"delete a stop", cellClick:function(e, cell){
			if(confirm('Are you sure you want to delete this entry?'))
				cell.getRow().delete();
			}
		},
	],
	rowSelected:function(row){ //when a row is selected
		// document.getElementById('searchName').value = row.getData().stop_name; // of fuzzy, retired
		// console.log('ID: ' + row.getIndex());
		// globalIndex = row.getIndex();
		
		setTimeout(function() {
			hide( document.querySelector("#panel") ); // when changing to next stop, old stop shouldn't show.

			if(row.getData().suggested) mapSuggested(row.getData().suggested, row.getData().stop_name); // show suggested locations
			else $('#autoSuggest').hide('slow');

			// if it has lat-long, show on map!
			// if (map.hasLayer(databank)) map.removeLayer(databank); // remove databank layer of past stop's matches when switching to another row.
			var lat = parseFloat(row.getData().stop_lat);
			var lon = parseFloat(row.getData().stop_lon);
			if ( checklatlng(lat,lon) ) {
				if (!map.hasLayer(stopsLayer)) map.addLayer(stopsLayer); // to do : check if visible already, then show if not
				mapZoomHere(lat,lon);
			} 
			// else loadRight(); // if not already mapped, then fuzzy search
	
		}, 500); //wait then run all this
	},
	rowDeselected:function(row){ //when a row is selected
		hide( document.querySelector("#panel") );
		//$('#autoSuggest').html('');
		suggestedLayer.clearLayers();
		//$('#autoSuggest').hide('slow');
	},
	dataEdited:function(data){
		//if(data.length) mapStops();
	},
	rowUpdated:function(row){
		setTimeout(mapStops,500);
	},
	dataFiltered:function(filters, rows){
		if(rows.length) { 
			setTimeout(function() {
				mapStops(); 
				if(lineLayer.getLayers().length && map.hasLayer(lineLayer)) {
					map.removeLayer(lineLayer);
					routeLines();
				}
			},1000);
		}
	},
	dataLoaded:function(data){
		if(!data.length) return;
		setTimeout(function() { mapStops(firstRun=true); },1000); // load the map but after an interval

		/*
		//empty the select element
		olcSelectTop.empty();
		//fill the select element with options from the data
		olcSelectTop.append("<option value=''>All</option>");
		ol6Collector = new Set(); // using sets in js. from https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Set
		data.forEach(function(item){
			if(!item.olc6) return;
			if( item.olc6.length > 0 && !ol6Collector.has(item.olc6) ) {
				value = item.olc6.slice(start=3, end=7);
				ol6Collector.add(item.olc6);
				olcSelectTop.append("<option value='" + item.olc6 + "'>" + value + "</option>");
			}
		});
		*/
	},

	cellEditing:function(cell){
		// pop up the stop on the map when user starts editing
		row = cell.getRow(); //.getData().stop_id);
		row.toggleSelect();
	},
	/* crap its doing its job but diabling all row highlight colors etc
	rowFormatter:function(row){
		// from https://tabulator.info/docs/4.1/format#format
        var data = row.getData();
        if(data.suggested){
            row.getElement().style['background-color'] = suggestedTabularColor;
        }
    }, */
});

const databankTable_height = 400;
var databankTable = new Tabulator("#databankTable", {
	height: databankTable_height,
	selectable:1, // make max 1 row click-select-able. https://tabulator.info/docs/3.4?#selectable
	movableRows: true, //enable user movable rows
	movableColumns: true, //enable user movable columns
	//layout:"fitColumns", //fit columns to width of table (optional)
	index: "stop_id", 
	layout:"fitDataFill",
	addRowPos: "top",
	tooltipsHeader:true, //enable header tooltips
	columns:[ //Define Table Columns
		// stop_id,stop_name,stop_lat,stop_lon,zone_id,wheelchair_boarding
		{rowHandle:true, formatter:"handle", headerSort:false, frozen:true, width:30, minWidth:30},
		//{title:"Num", width:40, formatter: "rownum", frozen:true }, // row numbering
		
		{title:"sr", field:"sr", headerFilter:"input", frozen:true },
		{title:"stop_name", field:"stop_name", headerFilter:"input", bottomCalc:stopsTotal, frozen:true },
		{title:"source", field:"source", headerFilter:"input" },
		{title:"rank", field:"rank", headerFilter:"input" },
		{title:"stop_lat", field:"stop_lat", headerSort:false },
		{title:"stop_lon", field:"stop_lon", headerSort:false },
		{title:"stop_id", field:"stop_id", headerFilter:"input" },
		{title:"stop_desc", field:"stop_desc", headerFilter:"input" },

		/*
		// Top algos, one of Fuzzywuzy and other of Jellyfish
		{title:"Fpartial", field:"Fpartial", headerFilter:"input", sorter:"number", headerTooltip:"Fuzzywuzzy partial ratio" },
		{title:"JjaroW", field:"JjaroW", headerFilter:"input", sorter:"number", headerTooltip:"Jellyfish jaro_winkler" },

		// Fuzzywuzzy:
		
		{title:"Fsimple", field:"Fsimple", headerFilter:"input", sorter:"number", headerTooltip:"Fuzzywuzzy ratio" },
		{title:"FtokenSort", field:"FtokenSort", headerFilter:"input", sorter:"number", headerTooltip:"Fuzzywuzzy token_sort_ratio" },
		{title:"FtokenSet", field:"FtokenSet", headerFilter:"input", sorter:"number", headerTooltip:"Fuzzywuzzy token_set_ratio" },
		
		// Jellyfish:
		{title:"Jlevenshtein", field:"Jlevenshtein", headerFilter:"input", sorter:"number", headerTooltip:"Jellyfish levenshtein_distance" },
		{title:"Jdamerau", field:"Jdamerau", headerFilter:"input", sorter:"number", headerTooltip:"Jellyfish damerau_levenshtein_distance" },
		{title:"Jhamming", field:"Jhamming", headerFilter:"input", sorter:"number", headerTooltip:"Jellyfish hamming_distance" },
		{title:"JjaroD", field:"JjaroD", headerFilter:"input", sorter:"number", headerTooltip:"Jellyfish jaro_distance" },
		{title:"Jmatch", field:"Jmatch", headerFilter:"input", sorter:"number", headerTooltip:"Jellyfish match_rating_comparison" },
		*/
	],
	rowSelected:function(row){ //when a row is selected
		var lat = parseFloat(row.getData().stop_lat);
		var lon = parseFloat(row.getData().stop_lon);
		var otherdata = `${row.getData().stop_name}<br>ID:${row.getData().stop_id}, ${row.getData().source}`;
		mapZoomHere(lat,lon); 

		askToMapSelected(lat,lon,otherdata); // ask user on the map if they want to map this
		dragmarker.remove(); clickedflag=false;

	},
	rowDeselected:function(row){ //when a row is selected
		hide( document.querySelector("#panel") );
	},
	dataLoaded: function(data) {
		if(!data.length) return;

		/*
		//empty the select element
		olcSelectBottom.empty();
		//fill the select element with options from the data
		olcSelectBottom.append("<option value=''>All</option>");
		ol6Collector = new Set(); // using sets in js. from https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Set
		data.forEach(function(item){
			if(!item.olc6) return;
			if( item.olc6.length > 0 && !ol6Collector.has(item.olc6) ) {
				value = item.olc6.slice(start=3, end=7);
				ol6Collector.add(item.olc6);
				olcSelectBottom.append("<option value='" + item.olc6 + "'>" + value + "</option>");
			}	
		});
		*/
	},

	dataSorted:function(sorters, rows){
		// first its loaded then its sorted and then the mapping happens on the sorted data.
		if(rows.length) setTimeout(function() {
			limit = $('#databankLimit').val();
			mapDataBank(limit=limit);
			mapStops(); // putting them on top
		}, 1000);
	}

});

// #################################
/* 3. Initiate map */
// background layers, using Leaflet-providers plugin. See https://github.com/leaflet-extras/leaflet-providers
var OSM = L.tileLayer.provider('OpenStreetMap.Mapnik');
var MBlight = L.tileLayer.provider('MapBox', {id: 'nikhilsheth.m0mmobne', accessToken: MBaccessToken });
var MBdark = L.tileLayer.provider('MapBox', {id: 'nikhilsheth.jme9hi44', accessToken: MBaccessToken });
var MBstreets = L.tileLayer.provider('MapBox', {id: 'nikhilsheth.m0mlpl2d', accessToken: MBaccessToken });
var MBsatlabel = L.tileLayer.provider('MapBox', {id: 'nikhilsheth.m0mmaa87', accessToken: MBaccessToken });
var OSMIndia = L.tileLayer.provider('MapBox', {id: 'openstreetmap.1b68f018', accessToken: MBaccessToken });
var gStreets = L.tileLayer('https://{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}',{maxZoom: 20, subdomains:['mt0','mt1','mt2','mt3']});
var gHybrid = L.tileLayer('https://{s}.google.com/vt/lyrs=s,h&x={x}&y={y}&z={z}',{maxZoom: 20, subdomains:['mt0','mt1','mt2','mt3']});
var baseLayers = { "OpenStreetMap.org" : OSM, "OpenStreetMap.IN": OSMIndia, "Streets": MBstreets, "Satellite": MBsatlabel, "Light": MBlight, "Dark" : MBdark, "gStreets": gStreets, "gHybrid": gHybrid };

var map = new L.Map('map', {
	center: STARTLOCATION,
	zoom: 10,
	layers: [MBlight],
	scrollWheelZoom: true,
	maxZoom: 20,
});

$('.leaflet-container').css('cursor','crosshair'); // from https://stackoverflow.com/a/28724847/4355695 Changing mouse cursor to crosshairs

L.control.scale({metric:true, imperial:false}).addTo(map);

// SVG renderer
var myRenderer = L.canvas({ padding: 0.5 });

// Marker for positioning new stop or changing location of stop
var dragmarkerOptions = {
	//renderer: myRenderer,
	radius: 5,
	fillColor: "red",
	color: null,
	weight: 1,
	opacity: 1,
	fillOpacity: 0.8,
	interactive: false
};
var dragmarker = L.circleMarker(null, dragmarkerOptions);
//layerControl.addOverlay(dragmarker , "Marker");

//lineLayer.addTo(map);

var overlays = {
	"Marker" : dragmarker,
	"Data Bank": databank,
	"Route Lines": lineLayer,
	"Mapped Stops": stopsLayer,
	"Auto-suggested Locations": suggestedLayer,
	"depots": depotsLayer,
	"Mapillary Photos": mapillaryLayer,
	"GPX Waypoints": waypointLayer,
	"GPX Track": trackLayer,
};
var layerControl = L.control.layers(baseLayers, overlays, {collapsed: true, autoZIndex:false}).addTo(map); 

// buttons on map
L.easyButton('<img src="lib/zoom-out.svg" width="100%" title="zoom to see all stops in top table" data-toggle="tooltip" data-placement="right">', function(btn, map){

	if( routeTable.getDataCount(true) && mappedList.length )
		map.fitBounds(stopsLayer.getBounds(), {padding:[20,20], maxZoom:15});
}).addTo(map);

L.easyButton('<img src="lib/route.svg" width="100%" title="toggle route lines" data-toggle="tooltip" data-placement="right">', function(btn, map){
	routeLines();
}).addTo(map);

// https://github.com/Leaflet/Leaflet.fullscreen
map.addControl(new L.Control.Fullscreen({position:'topright'}));

L.control.custom({
	position: 'bottomleft',
	content: `<a onclick="toggleLayer('databank')" href="javascript:;">toggle databank</a>`,
	classes: 'divOnMap2'
}).addTo(map);

L.control.custom({
	position: 'bottomright',
	content: `<a onclick="openMapillary()" href="javascript:;">fetch nearby Mapillary pics</a><br>
		<span id="mapillaryStatus"></span>`,
	classes: 'divOnMap2'
}).addTo(map);
// ########################
// RUN ON PAGE LOAD
$(document).ready(function() {

	$.ajaxSetup({ cache: false }); // from https://stackoverflow.com/a/13679534/4355695 to force ajax to always load from source, don't use browser cache. This prevents browser from loading old route jsons.
	
	$(window).resize(function(){
		routeTable.redraw();
		databankTable.redraw();
	});
	
	hide( document.querySelector("#panel") );

	map.on('click', function(e) {
		map.panTo(e.latlng);
		dragmarker.setLatLng(e.latlng);
		if(!clickedflag) { 
			map.addLayer(dragmarker);
			clickedflag=true; 
			databankTable.deselectRow(); // deselect selected row if any to show that we are now in manual mode.
		}
		
		var selectedRows = routeTable.getSelectedData(); //$("#left-table").tabulator("getSelectedRows"); //get array of currently selected row components.
		if(selectedRows.length) {
			var row = selectedRows[0];
			var lat = Math.round(( e.latlng.lat + 0.0000001) * 100000) / 100000;
			var lon = Math.round(( e.latlng.lng + 0.0000001) * 100000) / 100000;
			show( document.querySelector("#panel") );
			$('#location').html(`${lat},${lon}<br><button class="btn btn-sm btn-danger" onclick="mapToSelectedRow(${lat},${lon})">Pin "${row.stop_name}" here</button>` );
		}
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

	loadRoutesList(); // defined in common.js.. 4.2.19 NOPE moved it back here! want to put at end of it a way to auto-load route if specified

	let fileInput = document.getElementById('gpxFile');
	fileInput.addEventListener('change', function(e) {
		gpxUpload();
	});
	

	// populate confidence dropdown
	var confidenceCollector = '';
	Object.keys(confidence_options).forEach(element => {
		confidenceCollector += `<option value="${element}">${confidence_options[element]}</option>`;
	});
	$('#confidenceSelect').html(confidenceCollector);

	$('#routeSelect').on('change', function (e) {
		if( this.value == '') { 
			return;
		}
		if(globalChangesDone) {
			if(!confirm('Warning: There are unsaved changes on this route which will be lost. Sure you want to proceed?') ) {
				// no changes, return to normal.
				// hey, change the routeSelect back to orig
				$('#routeSelect').val(globalRoute);
				$('#routeSelect').trigger('chosen:updated');
				return;
			} else {
				// user has given consent to abandon changes.
				globalChangesDone = false;
			}
		}
		// 30.3.19 : NOW it's safe to change the globalRoute. Earlier we were changing it first itself and then if user opted to not proceed then it was still changed to new value, and that resulted in over-writing other trips! gasp!
		globalRoute = this.value;
		console.log(globalRoute);
		loadRoute(globalRoute);
	});

	// load depots
	loadDepots();

	setTimeout(function(){ loadBanksBackground(); }, 5000); // run 5 secs after page loads
	
});

//#####################################
// API Call functions

function loadRoutesList() {
	$.get( `${APIpath}loadJsonsList`, function( data ) {
		//console.log(data);
		$('#routeSelect').html(data);
		$('#routeSelect').trigger('chosen:updated'); 
		$('#routeSelect').chosen({disable_search_threshold: 1, search_contains:true, width:200, height: 400, placeholder_text_single:'Pick a route'});

		// check URLParams if a route is supposed to be loaded
		if(URLParams['route']) {
			console.log('Auto-loading route:',URLParams['route']);
			globalRoute = URLParams['route'];
			loadRoute(false);
			$('#routeSelect').val(globalRoute);
			$('#routeSelect').trigger('chosen:updated');
		}
	});
}

function loadRoute(firstTime=true) {
	
	// check for changes
	if(globalChangesDone) {
		if(!confirm('Warning: There are unsaved changes on this route which will be lost. Sure you want to proceed?') )
			return;
		else globalChangesDone = false;
	}

	// CLEAR STUFF
	$('#autoSuggest').hide('slow');
	hide( document.querySelector("#panel") );
	$('#routeStatus').html('loading..');
	$('#routeSaveStatus').html('');
	$('#routeLockStatus').html('');
	//$('#routeSuggestStatus').html('');


	if(firstTime) globalRoute = $("#routeSelect").val();
	console.log(globalRoute);

	//$.get( `${APIpath}loadJson?route=${globalRoute}`, function( response ) {
	// 12.2.18 : intervention : we're loading the whole json file's content anyways. Why not just do directly from JS?
	// Doing that, but to prevent browser from using old version of file in cache, need to put one command in document.ready block. See https://stackoverflow.com/a/13679534/4355695 . Have put it in common.js .
	$.getJSON(`routes/${globalRoute}`, function(data) {
		//var data = JSON.parse(response);
		//console.log(data);
		// get stopsArray0, stopsArray1

		$('#routeStatus').html(`<b>${globalRoute}</b>`);
		for(i=0;i<data['stopsArray0'].length; i++) {
			data['stopsArray0'][i]['direction_id'] = "0";
			data['stopsArray0'][i]['stop_sequence'] = i+1;
		}

		if(data['stopsArray1']) {
			for(i=0;i<data['stopsArray1'].length; i++) {
				data['stopsArray1'][i]['direction_id'] = "1";
				data['stopsArray1'][i]['stop_sequence'] = i+1;
			}
		} else {
			data['stopsArray1'] = [];
		}
		
		var tableData = new Array();
		// to do : make child rows/tables for auto-suggest
		data['stopsArray0'].forEach(element => {
			tableData.push(makeStopRow(element));
		});
		data['stopsArray1'].forEach(element => {
			tableData.push(makeStopRow(element));
		});

		//console.log(tableData);
		routeTable.setData(tableData);
		routeTable.clearFilter(true); // clear the filter, so people are not misled into thinking there's only one direction here etc.
		
		if (!map.hasLayer(stopsLayer)) map.addLayer(stopsLayer);
		mapStops();

		var changes = listChanges(data['changes']);

		let additionalInfo = `
		routeName: ${data['routeName'] || ''}<br>
		depot: ${globalRoute.split('/')[0] || ''}<br>
		busType: ${data['busType'] || ''}<br>
		extra0: ${data['extra0'] || ''}<br>
		extra1: ${data['extra1'] || ''}<br><br>
		changeLog:<br>
		<small>${changes || ''}
		<br>(times in UTC)</small>

		`;
		$('#additionalInfo').html(additionalInfo);

	}).fail(function(err) {
		$('#routeStatus').html(err.responseText);
	});

}


function saveRoute() {
	// globalRoute; // take the last loaded route value
	console.log('saveRoute(): filename is:',globalRoute);
	var sequence = routeTable.getData(); //$("#left-table").tabulator('getData');
	if(!sequence.length || !globalRoute) {
		$('#routeSaveStatus').html('Nothing to save.');
		return;
	}

	$('#routeSaveStatus').html('Saving...');
	
	//pw = prompt('Please provide a Mapper level password.');
	// using globalApiKey now

	$.ajax({
		url : `${APIpath}loadJson?route=${globalRoute}&key=${globalApiKey}`,
		type : 'POST',
		data : JSON.stringify(sequence),
		cache: false,
		processData: false,  // tell jQuery not to process the data
		contentType: false,  // tell jQuery not to set contentType
		success : function(returndata) {
			console.log('Successfully sent data via POST to server /API/loadJson, response received: ' + returndata);
			$('#routeSaveStatus').html(`<p class="alert alert-success">${returndata}</p>`);
			globalChangesDone = false;
			setTimeout(function(){ $('#routeSaveStatus').html(''); }, 180000);
		},
		error: function(jqXHR, exception) {
			console.log( jqXHR.responseText );
			$('#routeSaveStatus').html(`<p class="alert alert-danger">${jqXHR.responseText}</p>`);
			setTimeout(function(){ $('#routeSaveStatus').html(''); }, 180000);
		}
	});

}

function gpxUpload() {
	var fileInput = document.getElementById('gpxFile');
	if (!fileInput.files || fileInput.files.length <= 0) {
		return;
	}
	
	var formData = new FormData();
	formData.append('gpx', fileInput.files[0]);

	$.ajax({
		url : `${APIpath}GPXUpload`,
		type : 'POST',
		data : formData,
		cache: false,
		processData: false,  // tell jQuery not to process the data
		contentType: false,  // tell jQuery not to set contentType
		success : function(returndata) {
			console.log('API/GPXUpload POST request with file upload successfully done.');
			mapGPX(JSON.parse(returndata));
		},
		error: function(jqXHR, exception) {
			console.log( jqXHR.responseText );
		}
	});
}

function routeSuggest() {
	// use globalRoute

	// check for changes
	if(globalChangesDone) {
		if(!confirm('Warning: There are unsaved changes on this route which will be lost. Sure you want to proceed?\nPress Cancel to go back and Save changes first.') )
			return;
		else globalChangesDone = false;
	}

	//pw = prompt('Please provide a Mapper level password.');
	// use globalApiKey
	
	$('#routeSuggestStatus').html(`<p class="alert alert-warning">Processing..</p>`);

	$.get( `${APIpath}routeSuggest?route=${globalRoute}&key=${globalApiKey}`, function( response ) {
		$('#routeSuggestStatus').html(`<p class="alert alert-success">${response}</p>`);
		setTimeout(function(){ $('#routeSuggestStatus').html(''); }, 180000);
		loadRoute(firstTime=false);

	}).fail(function(err) {
		$('#routeSuggestStatus').html(`<p class="alert alert-danger">${err.responseText}</p>`);
		setTimeout(function(){ $('#routeSuggestStatus').html(''); }, 180000);
		
	});
}

function lockRoute() {
	// globalRoute
	// basic check : if all stops aren't mapped, Illa Po!
	routeTable.clearFilter(true);
	var data = routeTable.getData();
	mappedList = data.filter(a => ! isNaN(parseFloat(a.stop_lat))); // .filter() : from https://medium.com/poka-techblog/simplify-your-javascript-use-map-reduce-and-filter-bd02c593cc2d
	if( mappedList.length < data.length) {
		$('#routeLockStatus').html(`<p class="alert alert-danger">Map all the stops first!</p>`);
		setTimeout(function() { $('#routeLockStatus').html(''); },180000);
		return;
	}

	if(globalChangesDone) {
		alert('Save the route properly first!');
		return;
	}
	
	if(! confirm('- Are all the stops properly mapped?\n- Any criss-crossing of route lines?\nPress OK if you are sure you want to lock this route')) return;
	// *pw = prompt('Please provide a Reviewer level password.');
	// use globalApiKey

	$.get( `${APIpath}routeLock?route=${globalRoute}&key=${globalApiKey}`, function( response ) {
		$('#routeLockStatus').html(`<p class="alert alert-success">${response}</p>`);
		setTimeout(function() { $('#routeLockStatus').html(''); },180000);

	}).fail(function(err) {
		$('#routeLockStatus').html(`<p class="alert alert-danger">${err.responseText}</p>`);
		setTimeout(function() { $('#routeLockStatus').html(''); },180000);
	});

}
// ########################################################
// JS FUNCTIONS

function makeStopRow(element) {
	let rowJson = { 'direction_id':element.direction_id, 'stop_sequence':element.stop_sequence, 'stop_name':element.stop_name};
	if(element.stop_lat) rowJson['stop_lat'] = parseFloat( String(element.stop_lat).trim() );
	if(element.stop_lon) rowJson['stop_lon'] = parseFloat( String(element.stop_lon).trim() );
	if(element.offset) rowJson['offset'] = element.offset;
	if(element.confidence) rowJson['confidence'] = element.confidence;
	if(element.stop_desc) rowJson['stop_desc'] = element.stop_desc;
	if(element.suggested) rowJson['suggested'] = element.suggested;
	return rowJson;
}


function loadDatabank(src="databank") {
	
	/*var global_stops_mapped = [];
	var global_databank = [];
	var global_stops_automapped = [];
	var global_postoffice = [];*/
	switch (src) {
		case 'mapped':
			databankTable.setData(global_stops_mapped);
			break;
		
		case 'automapped':
			databankTable.setData(global_stops_automapped);
			break;
		
		case 'postoffice':
			databankTable.setData(global_postoffice);
			break;
		
		case 'hamlets':
			databankTable.setData(global_hamlets);
			break;
		
		default:
			databankTable.setData(global_databank);
			break;
	}
	/*
	Papa.parse(`${filename}?_=${globalRandom}`, {
		download: true,
		header: true,
		skipEmptyLines: true,
		complete: function(results, file) {
			//console.log("Parsing complete:", results, file);
			databankTable.setData(results.data);
		}
	});*/
}

function mapToSelectedRow(lat,lon) {
	console.log('mapToSelectedRow():',lat,lon);
	var selectedRows = routeTable.getSelectedRows(); //$("#left-table").tabulator("getSelectedRows");
	var row = selectedRows[0];
	// row component : https://tabulator.info/docs/3.5#component-row
	row.getCell('stop_lat').setValue(lat);
	row.getCell('stop_lon').setValue(lon);
	row.getCell('confidence').setValue($('#confidenceSelect').val());
	//row.getCell('source').setValue('manual');
	//row.getCell('source_stop_id').setValue('');
	//row.getCell('source_stop_name').setValue('');
	mapStops();	
	if(map.hasLayer(lineLayer)) {
		routeLines();
		routeLines();
	}

	// reset confidence select
	document.getElementById('confidenceSelect').selectedIndex = 0;

	// changes flag
	globalChangesDone = true;
}


// who's using this??
function updateLatLng(latlong, revflag) {
	if (revflag) {
		lat = parseFloat( latlong.split(',')[0] );
		lng = parseFloat( latlong.split(',')[1] );
		dragmarker.setLatLng([lat, lng]);
		map.panTo([lat, lng]);
	} else {
		lat = Math.round(( dragmarker.getLatLng().lat + 0.0000001) * 10000) / 10000;
		// Rounding, from https://stackoverflow.com/questions/11832914/round-to-at-most-2-decimal-places-only-if-necessary. The +0.000.. is to trip forward a number hinging on x.9999999...
		lng = Math.round(( dragmarker.getLatLng().lng + 0.0000001) * 10000) / 10000;
		document.getElementById('newlatlng').value = lat + ',' + lng;
		//document.getElementById('longitude').value = marker.getLatLng().lng;
		//map.panTo(dragmarker.getLatLng());
	}
}

function mapDataBank(limit=false, filter=true) {

	databank.clearLayers();
	//if (map.hasLayer(stopsLayer)) map.removeLayer(stopsLayer);

	if(filter)
		var stopsjson = databankTable.getData(true); //$("#right-table").tabulator("getData",true); // gets filtered data from table
	else
		var stopsjson = databankTable.getData(); //$("#right-table").tabulator("getData"); // gets full data from table

	if(debugMode) {
		console.log('mapDataBank: first stop:',stopsjson[0]);
		console.log('mapDataBank: limit:' + limit);
	}
	if(limit) {
		stopsjson = stopsjson.slice(0,limit);
	}
	for (i = 0; i < stopsjson.length; i++) {
		stoprow = stopsjson[i];
		// debugging: 

		let lat = parseFloat(stoprow['stop_lat']);
		let lon = parseFloat(stoprow['stop_lon']);
		if( ! checklatlng(lat,lon) ) {
			console.log('mapDataBank: Skipping a stop because of invalid values:', stopsjson[stoprow]);
			continue;
		}

		// stopRadius = 1 + 5*parseFloat(stoprow[param])/100;
		// no no, too complicated at frontend, don't bother grading the markers by the scores.

		var circleMarkerOptions = {
			renderer: myRenderer,
			radius: 4,
			fillColor: databankColor,
			color: 'black',
			weight: 0.7,
			opacity: 1,
			fillOpacity: 0.7
		};

		var tooltipContent = '';
		var id = stoprow.stop_id;
		if(id) {
			if(id.length >= 10) {
				id = id.substr(0,3) + '..' + id.substr(id.length-5);
			}
			tooltipContent = `${i+1}: ${stoprow.stop_name}<br>${stoprow.source}: ${id}`;
		} else {
			tooltipContent = `${i+1}: ${stoprow.stop_name}<br>${stoprow.depot}:${stoprow.jsonFile}`;
		}
		
		

		var stopmarker = L.circleMarker([lat,lon], circleMarkerOptions)
			.bindTooltip(tooltipContent, {
				direction:'top', 
				offset: [0,-5]
			});
		stopmarker.properties = stoprow;
		stopmarker.addTo(databank);
	}
	
	if( ! map.hasLayer(databank) ) map.addLayer(databank);

	//map.fitBounds(databank.getBounds(), {padding:[-20,-20], maxZoom:15}); 

}


function mapStops(firstRun=false, zoomBack=true){

	if(firstRun) firstRunDone = true; // only dataloaded callback sends firstRun as true

	if(!firstRunDone) {
		if(debugMode) console.log('mapStops called but firstRunDone flag not set yet.');
		return;
	}

	stopsLayer.clearLayers();

	// calculation
	let totalRowsNum = routeTable.getDataCount();
	
	var data = routeTable.getData(true); //$("#left-table").tabulator('getData',true);
	mappedList = data.filter(a => ! isNaN(parseFloat(a.stop_lat)));
	// .filter() : from https://medium.com/poka-techblog/simplify-your-javascript-use-map-reduce-and-filter-bd02c593cc2d
	// and figured out a way to detect if a variable is a number and not null or undefined or blank or string
	percentage = Math.round( mappedList.length / totalRowsNum * 100 );
	$('#numMapped').html(`<b>${mappedList.length} (${percentage}%)</b> stops mapped so far.`);
	
	for (i = 0; i < mappedList.length; i++) {
		stoprow = mappedList[i];
		
		let lat = parseFloat(stoprow['stop_lat']);
		let lon = parseFloat(stoprow['stop_lon']);
		
		if( ! checklatlng(lat,lon) ) {
			console.log('Skipping a stop because of invalid values:', stopsjson[stoprow]);
			continue;
		}

		var circleMarkerOptions = {
			renderer: myRenderer,
			radius: 6,
			fillColor: directionDecide(stoprow),
			color: 'black',
			weight: 0.5,
			opacity: 1,
			fillOpacity: 0.7
		};
		var tooltipContent = `${stoprow.stop_name}`;
		if(stoprow.stop_sequence) tooltipContent = `${stoprow.stop_sequence}:${tooltipContent}`; // prefix sequence
		
		var stopmarker = L.circleMarker([lat,lon], circleMarkerOptions).bindTooltip(tooltipContent);
		stopmarker.properties = stoprow;
		stopmarker.addTo(stopsLayer);
	}
	if (map.hasLayer(stopsLayer) && mappedList.length & zoomBack) 
		//map.fitBounds(stopsLayer.getBounds(), {padding:[20,20], maxZoom:15}); 
		;
	// if the layer is activated, then zoom to fit.
}

// function directionDecide(stoprow){} : moved to common.js


function mapZoomHere(lat,lon,zoom=16) {
	if( ! checklatlng(lat,lon) ) {
		console.log('mapZoomHere(): invalid lat-lon values:', lat,lon);
		return;
	}
	map.panTo([lat,lon], {/*duration:1,*/ animate:true}); //1.2.19 : no more zooming business, let's just pan at whatever zoom the mapper has set as preferable.

}

//function openExternalMap(site='m'){}
// moved to common.js

function askToMapSelected(lat,lon, otherdata=''){
	if( ! checklatlng(lat,lon) ) {
		console.log('askToMapSelected: invalid lat-lon values:', lat,lon);
		return;
	}
	var selectedRows = routeTable.getSelectedData(); //$("#left-table").tabulator("getSelectedRows"); //get array of currently selected row components.
	if(selectedRows.length) {
		var row = selectedRows[0];
		
		$('#location').html(`${lat},${lon}, ${otherdata}<br><button class="btn btn-primary btn-sm" onclick="mapCopyOver()">Pin "${row.stop_name}" here</button>` );
		show( document.querySelector("#panel") );
	}
}

function mapCopyOver() {

	var selectedRows = routeTable.getSelectedRows(); //$("#left-table").tabulator("getSelectedRows"); //get array of currently selected row components.
	if(selectedRows.length) {
		var row = selectedRows[0];

		var rightSelected = databankTable.getSelectedData();// $("#right-table").tabulator("getSelectedRows")
		
		if(rightSelected.length) {
			var source = rightSelected[0];
			console.log('mapCopyOver: source:',source);
		
			row.getCell('stop_lat').setValue(source.stop_lat);
			row.getCell('stop_lon').setValue(source.stop_lon);
			//row.getCell('source').setValue(source.source);
			//row.getCell('source_stop_id').setValue(source.stop_id);
			//row.getCell('source_stop_name').setValue(source.stop_name);
			mapStops(firstRun=false, zoomBack=false);
		}	
		else {
			alert('Error: No row in data bank table is selected.');
			return;
		}
	}
	else {
		alert('Error: No row in stops table is selected.');
		return;
	}
}



function mapGPX(data) {
	console.log(data);

	trackLayer.clearLayers();
	if (data.hasOwnProperty('track')) {
		if (data['track'].length > 1) {
			var shapeLine = L.polyline.antPath(data['track'], {color: 'orange', weight:3, interactive:false, delay:2000}).addTo(trackLayer);
			if (!map.hasLayer(trackLayer)) map.addLayer(trackLayer);
		}
	}

	waypointLayer.clearLayers();
	var circleMarkerOptions = {
			renderer: myRenderer,
			radius: 5,
			fillColor: 'orange',
			color: 'black',
			weight: 1,
			opacity: 1,
			fillOpacity: 0.7
	};
	for (i = 0; i < data.waypoint.length; i++) {
		row = data.waypoint[i];
		var tooltipContent = `GPX:${i+1}: <b>${row.name}</b><br>${row.time}`;
		let lat = parseFloat(row.lat);
		let lon = parseFloat(row.lon);
		var waypointMarker = L.circleMarker([lat,lon], circleMarkerOptions).bindTooltip(tooltipContent);
		waypointMarker.properties = row;
		waypointMarker.addTo(waypointLayer);
	}
	if (!map.hasLayer(waypointLayer)) map.addLayer(waypointLayer);
}

function addStop() {
	routeTable.addRow({'stop_name': $('#addStop').val() });
	//$("#left-table").tabulator('addRow');
}

function routeLines() {
	data = routeTable.getData(true); //$("#left-table").tabulator('getData',true);
	if(! data.length) return;
	
	if(lineLayer.getLayers().length && map.hasLayer(lineLayer)) {
		// toggle off if already loaded and visible
		map.removeLayer(lineLayer);
		return;
	}

	lineLayer.clearLayers();

	var dir0Line = [];
	var dir1Line = [];
	for( i=0; i<data.length; i++) {
		let lat = parseFloat(data[i].stop_lat);
		let lon = parseFloat(data[i].stop_lon);
		if(checklatlng(lat,lon)) {
			if (data[i].direction_id == '1' || data[i].direction_id == 1)
				dir1Line.push([lat,lon]);
			
			else dir0Line.push([lat,lon]);
		}
		
	}

	if(dir0Line.length)
		var dir0MapLine = L.polyline.antPath(dir0Line, {color: stopOnwardColor, weight:2, delay:1500, interactive:false }).addTo(lineLayer);
	

	if(dir1Line.length)
		var dir1MapLine = L.polyline.antPath(dir1Line, {color: stopReturnColor, weight:2, delay:1500, interactive:false }).addTo(lineLayer);

	
	if (!map.hasLayer(lineLayer))
		map.addLayer(lineLayer);
}

function mapSuggested(suggested, name='') {
	suggestedLayer.clearLayers();
	suggestionsHTML = `Auto-suggested locations for stop ${name} :<br>`;
	if(!suggested.length) return;

	console.log(suggested);
	var arr = suggested.split(';');
	var count = 0;
	arr.forEach(element => {
		var parts = element.split(',');
		//console.log(parts);
		let lat = parseFloat(parts[1]);
		let lon = parseFloat(parts[2]);
		
		if(!checklatlng(lat,lon)) {
			console.log('invalid coords:',parts);
			return;
		}
		count ++;
		var circleMarkerOptions = {
			renderer: myRenderer,
			radius: 4,
			fillColor: suggestedColor,
			color: 'black',
			weight: 0.5,
			opacity: 1,
			fillOpacity: 0.5
		};
		// 10.2.19 : Intervention : put stop name if its there.
		let fullname = parts[0];
		if(parts.length > 3) fullname += ': ' + parts[3];

		var tooltipContent = 'source: ' + parts[0];
		var stopmarker = L.circleMarker([lat,lon], circleMarkerOptions)
			.bindTooltip(tooltipContent, {
				direction:'top', 
				offset: [0,-5]
		});
		stopmarker.addTo(suggestedLayer);

		// also : populate html autoSuggest
		suggestionsHTML += `<a href="javascript:{}" onclick="mapSuggestedZoomHere('${name}',${lat},${lon},16)" class="badge badge-primary">${count} ${fullname}</a>&nbsp;&nbsp;`;
	});

	suggestionsHTML += `<small><a href="javascript:;" onclick="toggleLayer('suggested')">Toggle Suggestions</a></small>`;
	if( ! map.hasLayer(suggestedLayer) ) map.addLayer(suggestedLayer);
	$('#autoSuggest').html(suggestionsHTML)
	$('#autoSuggest').show('slow');
}

function mapSuggestedZoomHere(name,lat,lon,zoom=16) {
	show( document.querySelector("#panel") );
	$('#location').html(`${lat},${lon}<br><button class="btn btn-sm btn-primary" onclick="mapToSelectedRow(${lat},${lon})">Pin "${name}" here</button>` );
	mapZoomHere(lat,lon,zoom);

}

function adoptSuggested() {
	// to do : get the whole data out to json, then process it there, then load the table again.
	// Because cells are out of DOM etc, directly trying to update cells is giving problems.

	if(!confirm('This will copy the first auto-suggested location to the stop_lat and stop_lon columns of each stop if they are still left blank. It may or may not be the right locations.\nAre you sure you want to do this?\n\nNote: it won\'t save the route, you have to save it yourself or reload the file to get rid of changes.') )
		return;
	
	routeTable.clearFilter(true);

	var data = routeTable.getData();
	console.log(data.length);

	for(let i=0;i<data.length;i++) {
		var rowData = data[i];
		let suggest = rowData['suggested'];

		// don't process if: no suggestion, or if stop already mapped.
		// new: do process if confidence level = 0
		if(!suggest) continue;
		if(rowData['stop_lat'] ) {
			if( String(rowData['stop_lat']).trim() )
				if( parseInt(rowData['confidence']) > 0  ) 
					continue;
		}

		let firstCoord = suggest.split(';')[0];
		if(!firstCoord) continue;
		let parts = firstCoord.split(',');
		if(parts.length < 3) continue;

		//console.log('parts:',parts.length,parts);
		
		rowData['stop_lat'] = parts[1];
		rowData['stop_lon'] = parts[2];
		rowData['confidence'] = "0"; // assigning zero value to indicate automapped.
	}
	// now once we're done editing the data at backend, load it fresh onto tabulator
	routeTable.setData(data)
	.then(function(){
		mapStops();
		globalChangesDone = true;
	})
	.catch(function(error){
		//handle error loading data
		console.log('adoptSuggested: Some error after trying to load the data back into table.');
		console.log(error);
	});

}

function reSequence() {
	routeTable.clearFilter(true);
	var data = routeTable.getData();
	onwardCount = 0;
	returnCount = 0;
	for(i=0; i< data.length; i++) {
		let stopRow = data[i];
		if(stopRow['direction_id'] == '1') {
			returnCount ++;
			stopRow['stop_sequence'] = returnCount;
		} else {
			onwardCount ++;
			stopRow['stop_sequence'] = onwardCount;
		}
	}
	routeTable.setData(data);

}

function listChanges(changesJson) {
	if(!changesJson) return '';
	if(!changesJson.length) return '';
	returnHTML = '';
	changesJson.forEach(element => {
		returnHTML += `${element.timestamp}: ${element.email}, ${element.function}<br>`;
	});
	console.log(returnHTML);
	return returnHTML;
}

function loadBanksBackground() {
	// to do: load up all the databanks in background to global variables. They will be used by tabulator to load up etc.
	// this function is called at end of page load afer some timeout
	
	// reports/stops_mapped.csv
	// databank/stops-databank.csv
	// reports/stops_automapped_unique.csv
	// databank/postoffice.csv
	console.log((new Date).getTime(),'Commencing loading of databanks.');

	let filename = 'reports/stops_mapped.csv';
	Papa.parse(`${filename}?_=${globalRandom}`, {
		download: true,
		header: true,
		skipEmptyLines: true,
		complete: function(results, file) {
			// pre-process it a bit
			results.data.forEach(r => {
				r['source'] = `${r['folder']}/${r['jsonFile']}:dir${r['direction_id']}`;
			});
			global_stops_mapped = results.data;
			console.log((new Date).getTime(),'stops_mapped.csv loaded');
			$('.databank#mapped').html('Mapped Stops');
		},
		error: function(err, file, inputElem, reason) {
			console.log(`${filename} not found. please run reports generation script once.`);
			$('.databank#mapped').hide();
        }
	});
	
	filename = 'databank/stops-databank.csv';
	Papa.parse(`${filename}?_=${globalRandom}`, {
		download: true,
		header: true,
		skipEmptyLines: true,
		complete: function(results, file) {
			global_databank = results.data;
			console.log((new Date).getTime(),'stops-databank.csv loaded');
			$('.databank#databank').html('Databank');

		}
	});

	filename = 'reports/stops_automapped_unique.csv';
	Papa.parse(`${filename}?_=${globalRandom}`, {
		download: true,
		header: true,
		skipEmptyLines: true,
		complete: function(results, file) {
			// pre-process it a bit
			results.data.forEach(r => {
				r['source'] = `${r['folder']}/${r['jsonFile']}:dir${r['direction_id']}`;
			});
			global_stops_automapped = results.data;
			console.log((new Date).getTime(),'stops_automapped_unique.csv loaded');
			$('.databank#automapped').html('Automapped Stops');
		}
	});

	filename = 'databank/postoffice.csv';
	Papa.parse(`${filename}?_=${globalRandom}`, {
		download: true,
		header: true,
		skipEmptyLines: true,
		complete: function(results, file) {
			global_postoffice = results.data;
			console.log((new Date).getTime(),'postoffice.csv loaded');
			$('.databank#postoffice').html('Post Offices');
		}
	});

	filename = 'databank/hamlets-hyderabad-region.csv';
	Papa.parse(`${filename}?_=${globalRandom}`, {
		download: true,
		header: true,
		skipEmptyLines: true,
		complete: function(results, file) {
			global_hamlets = results.data;
			console.log((new Date).getTime(),'hamlets-hyderabad-region.csv loaded');
			$('.databank#hamlets').html('Hamlets');
		}
	});

}

function toggleLayer(which="suggested") {
	if(which == "suggested") {
		if (!map.hasLayer(suggestedLayer)) map.addLayer(suggestedLayer);
		else map.removeLayer(suggestedLayer);
	}
	else if(which == "databank") {
		if (!map.hasLayer(databank)) map.addLayer(databank);
		else map.removeLayer(databank);
	}

}
//###############################
// GRAVEYARD
/*
	var rows = routeTable.getRows();
	console.log(rows.length);
	for(let i=0;i<rows.length;i++) {
		rowData = rows[i].getData();
		//console.log(rowData);
		let suggest = rowData['suggested'];
		if(!suggest) continue;
		
		if(rowData['stop_lat'] ) {
			if( String(rowData['stop_lat']).trim()  ) 
				continue;
		}
		
		
		let firstCoord = suggest.split(';')[0];
		//console.log(firstCoord);
		if(!firstCoord) continue;
		let parts = firstCoord.split(',');
		if(parts.length < 3) continue;

		console.log('parts:',parts.length,parts);
		
		try {
			rows[i].getCell('stop_lat').setValue(parts[1]);
			rows[i].getCell('stop_lon').setValue(parts[2]);
			rows[i].getCell('confidence').setValue("1");
		}
		catch(err) {
			console.log('err:',err);
			continue;
		}
		
	}
	*/
	
	/*
	rows.forEach(element => {
		if(element.getCell('suggested')) {
			let suggest = element.getCell('suggested').getValue();
			console.log(element.getCell('direction_id').getValue(), element.getCell('stop_name').getValue(), suggest);
			if(!suggest) return;
			let firstCoord = suggest.split(';')[0];
			//console.log(firstCoord);
			if(!firstCoord) return;
			let parts = firstCoord.split(',');
			console.log('lat:', element.getCell('stop_lat').getValue());
			console.log('parts:',parts.length,parts);
			if(!element.getCell('stop_lat').getValue() && parts.length >=3 ) {
				element.getCell('stop_lat').setValue(parts[1]);
				element.getCell('stop_lon').setValue(parts[2]);
			}
		// getCell('stop_lat').setValue(lat);

		}*/
	
	