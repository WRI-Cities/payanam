/* routemap.js
moved here from RouteMapper
*/

// ######################################
/* 1. GLOBAL VARIABLES */

// default point colors : MOVED to common.js

const routeTable_height = "400px";
// const globalRandom -> moved to js/common.js

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

// Databank: one json to rule them all
var global_DB = {};

// #################################
/* 2. Initiate tabulators */

// first, define custom functions that will be called by the table
var stopsTotal = function(values, data, calcParams){
	var calc = values.length;
	return calc + ' stops total';
}

/* var suggestedTrueFalse = function(cell, formatterParams, onRendered){
	let value = cell.getValue();
	console.log(value);
	if(value) {
		if(value.length)
			return true;
	}
	return false;
}; */

// dropdown for direction column. From https://github.com/olifolkerd/tabulator/issues/1011#issuecomment-476360437
var select = $("<select><option value=''>(all)</option><option value='0'>Up(0)</option><option value='1'>Down(1)</option></select>");
// note: below block is boilerplate code copied from tabulator. Do not distrurb!
var selectEditor = function (cell, onRendered, success, cancel, editorParams) {
    select.css({ "padding":"1px", "width":"100%", "box-sizing":"border-box" });
    select.val(cell.getValue()); //Set value of select to the current value of the cell
    onRendered(function(){ //set focus on the select box when the select is selected (timeout allows for select to be added to DOM)
        select.focus();
        select.css("height","100%");
    });
    //when the value has been set, trigger the cell to update
    select.on("change blur", function(e){
        success(select.val());
    });
    return select[0]; //return the select element // this needs to have [0] suffix
}

//########################
// now the actual table construction

var routeTable = new Tabulator("#routeTable", {
	height:routeTable_height,
	selectable:1, // make max 1 row click-select-able. https://tabulator.info/docs/3.4?#selectable
	movableRows: true, //enable user movable rows
	//layout:"fitColumns", //fit columns to width of table (optional)
	index: "id", 
	layout:"fitDataFill",
	addRowPos: "top",
	tooltipsHeader:true,
	columns:[ //Define Table Columns
		{rowHandle:true, formatter:"handle", headerSort:false, frozen:true},
		//{title:"orig_id", field:"orig_id", frozen:true, headerFilter:"input" },
		//{title:"Num", width:40, formatter: "rownum", headerSort:false}, // row numbering
		{title:"seq", field:"stop_sequence", editor:"input", headerFilter:"input", headerTooltip:"stop sequence number", width:15, headerSort:false, frozen:true },
		{title:"stop_name", field:"stop_name", editor:"input", headerFilter:"input", bottomCalc:stopsTotal, width:100, headerSort:false, frozen:true },
		{title:"direction", field:"direction_id", editor:"select", editorParams:{values:{"0":"Up(0)", "1":"Down(1)", "": "(none)"}}, width:70, headerSort:false, headerFilter:selectEditor },
		
		{title:"stop_lat", field:"stop_lat", headerSort:false, width:60, headerTooltip:"latitude" },
		{title:"stop_lon", field:"stop_lon", headerSort:false, width:60, headerTooltip:"longitude" },
		{title:"confidence", field:"confidence", headerFilter:"input", width:50, headerSort:false, editor:"select", editorParams:{values: confidence_options} },
		{formatter:unMapIcon, align:"center", title:"unmap", width:20, headerSort:false, headerTooltip:"remove mapping for this stop", cellClick:function(e, cell){
			if(! cell.getRow().getData()['stop_lat']) return;
			
			if(confirm('Are you sure you want to remove lat-long values for this stop?'))
				cell.getRow().update({'stop_lat':'','stop_lon':'', 'confidence':''});
				
				mapStops(); 
				if(lineLayer.getLayers().length && map.hasLayer(lineLayer)) {
					map.removeLayer(lineLayer);
					routeLines();
				}
			}
		},
		//{title:"offset", field:"offset", headerFilter:"input", editor:"input", headerTooltip:"arrival time, in mins after first stop", headerSort:false },
		{title:"stop_desc", field:"stop_desc", editor:"input", headerFilter:"input", width:100, headerSort:false },
		
		{formatter:"buttonCross", align:"center", title:"del", width:20, headerSort:false, headerTooltip:"delete a stop", cellClick:function(e, cell){
			if(confirm('Are you sure you want to delete this entry?'))
				cell.getRow().delete();
				mapStops(); 
				if(lineLayer.getLayers().length && map.hasLayer(lineLayer)) {
					map.removeLayer(lineLayer);
					routeLines();
				}
			}
		},
		{title:"suggested", field:"suggested", width:100, headerSort:false },
	],
	rowSelected:function(row){ //when a row is selected
		setTimeout(function() {
			hide( document.querySelector("#panel") ); // when changing to next stop, old stop shouldn't show.
			$('#stopInfo').html(`<big><b>${row.getData().stop_name}</b></big>`);

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
	
		}, 250); //wait then run all this
	},
	rowDeselected:function(row){ //when a row is selected
		hide( document.querySelector("#panel") );
		suggestedLayer.clearLayers();
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
			},500);
		}
	},
	dataLoaded:function(data){
		if(!data.length) return;
		setTimeout(function() { mapStops(firstRun=true); },500); // load the map but after an interval
	},

	cellEditing:function(cell){
		// pop up the stop on the map when user starts editing
		row = cell.getRow(); //.getData().stop_id);
		row.toggleSelect();
	},

	cellEdited:function(cell){
		// re-map stuff after an edit
		setTimeout(function() {
			mapStops(); 
			if(lineLayer.getLayers().length && map.hasLayer(lineLayer)) {
				map.removeLayer(lineLayer);
				routeLines();
			}
		},500);
	},

	rowMoved:function(row){
		// re-map stuff after a row-move
		setTimeout(function() {
			mapStops(); 
			if(lineLayer.getLayers().length && map.hasLayer(lineLayer)) {
				map.removeLayer(lineLayer);
				routeLines();
			}
		},500);
	},

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
		{title:"stop_desc", field:"stop_desc", headerFilter:"input" }
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
		}, 500);
	}

});

// #################################
/* 3. Initiate map */
// background layers, using Leaflet-providers plugin. See https://github.com/leaflet-extras/leaflet-providers
var OSM = L.tileLayer.provider('OpenStreetMap.Mapnik');
var cartoVoyager = L.tileLayer.provider('CartoDB.VoyagerLabelsUnder');
var cartoPositron = L.tileLayer.provider('CartoDB.Positron');
var cartoDark = L.tileLayer.provider('CartoDB.DarkMatter');
var esriWorld = L.tileLayer.provider('Esri.WorldImagery');
var gStreets = L.tileLayer('https://{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}',{maxZoom: 20, subdomains:['mt0','mt1','mt2','mt3']});
var gHybrid = L.tileLayer('https://{s}.google.com/vt/lyrs=s,h&x={x}&y={y}&z={z}',{maxZoom: 20, subdomains:['mt0','mt1','mt2','mt3']});

var baseLayers = { "CartoDB Voyager":cartoVoyager, "OpenStreetMap.org" : OSM, "CartoDB Light": cartoPositron, "CartoDB Dark": cartoDark, "ESRI Satellite": esriWorld, "gStreets": gStreets, "gHybrid": gHybrid };

var map = new L.Map('map', {
	center: STARTLOCATION,
	zoom: 10,
	layers: [cartoVoyager],
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
	position: 'bottomright',
	content: `<p align="right">Stop: <span id="stopInfo">select one</span><br>
	<a href="javascript:{}" onclick="nextStop(-1)"><< previous</a> | <a href="javascript:{}" onclick="nextStop(1)">next >></a><br><br>
	<a onclick="toggleLayer('databank')" href="javascript:;">toggle databank</a><br>
	<a onclick="openMapillary()" href="javascript:;">fetch nearby Mapillary pics</a><br>
		<span id="mapillaryStatus"></span></p>`,
	classes: 'divOnMap1'
}).addTo(map);

L.control.custom({
	position: 'bottomleft',
	content: `<div id="panel">
	<span id="location"></span><br>
	Confidence:<br>
	<select id="confidenceSelect" class="confidence-style"></select>
	</div>`,
classes: 'divOnMap1'
}).addTo(map);


// Add in a crosshair for the map. From https://gis.stackexchange.com/a/90230/44746
var crosshairIcon = L.icon({
    iconUrl: crosshairPath,
    iconSize:     [crosshairSize, crosshairSize], // size of the icon
    iconAnchor:   [crosshairSize/2, crosshairSize/2], // point of the icon which will correspond to marker's location
});
crosshair = new L.marker(map.getCenter(), {icon: crosshairIcon, interactive:false});
crosshair.addTo(map);
// Move the crosshair to the center of the map when the user pans
map.on('move', function(e) {
    crosshair.setLatLng(map.getCenter());
});

// lat, long in url
var hash = new L.Hash(map);


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

	loadDefaults(callbackFlag=true,callback=loadBanksBackground);
	//setTimeout(function(){ loadBanksBackground(); }, 5000); // run 5 secs after page loads
	
	// check URLParams if a route is supposed to be loaded
	if(URLParams['route']) {
		console.log('Auto-loading route:',URLParams['route']);
		globalRoute = URLParams['route'];
		loadRoute(false);
		$('#routeSelect').val(globalRoute);
		$('#routeSelect').trigger('chosen:updated');
	}
});

//#####################################
// API Call functions

function loadRoutesList() {
	$.get( `${APIpath}loadJsonsList`, function( data ) {
		//console.log(data);
		$('#routeSelect').html(data);
		$('#routeSelect').trigger('chosen:updated'); 
		$('#routeSelect').chosen({disable_search_threshold: 1, search_contains:true, width:200, height: 400, placeholder_text_single:'Pick a route'});
	}).fail(function(err) {
		loadRoutesCSV();
	});
}

function loadRoutesCSV() {
    // alternative to loadRoutesList() function, for payanam-lite
    // to do: load reports/routes.csv, and generate the routes list from there
    var filename = 'reports/routes.csv';
    console.log('Loading',filename);
    Papa.parse(`${filename}?_=${(new Date).getTime()}`, {
    download: true,
    header: true,
        skipEmptyLines: true,
        dynamicTyping: false, // this reads numbers as numerical; set false to read everything as string
        complete: function(results, file) {
            var returnHTML = '<option value="">Select one</option>';
            var depotsList = [];
            results.data.forEach(r => {
                if(!depotsList.includes(r.folder)) {
                    returnHTML += `<optgroup label="${r.folder}">`;
                    depotsList.push(r.folder);
                }
                returnHTML += `<option value="${r.folder}/${r.jsonFile}">${r.routeName}</option>`;
            });
            
            //console.log(returnHTML);
            $('#routeSelect').html(returnHTML);
            $('#routeSelect').trigger('chosen:updated'); 
            $('#routeSelect').chosen({disable_search_threshold: 1, search_contains:true, width:200, placeholder_text_single:'Pick a route'});
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

	if(firstTime) globalRoute = $("#routeSelect").val();
	console.log(globalRoute);

	// 12.2.18 : intervention : we're loading the whole json file's content anyways. Why not just do directly from JS?
	// Doing that, but to prevent browser from using old version of file in cache, need to put one command in document.ready block. See https://stackoverflow.com/a/13679534/4355695 . Have put it in common.js .
	$.getJSON(`routes/${globalRoute}`, function(data) {
		//var data = JSON.parse(response);
		//console.log(data);
		// get stopsArray0, stopsArray1

		$('#routeStatus').html(`<b>${globalRoute}</b>`);
		$('#routeSaveStatus').html('');
		idCounter = 0;
		for(i=0;i<data['stopsArray0'].length; i++) {
			data['stopsArray0'][i]['direction_id'] = "0";
			data['stopsArray0'][i]['stop_sequence'] = i+1;
			data['stopsArray0'][i]['id'] = idCounter;
			idCounter ++;
		}

		if(data['stopsArray1']) {
			for(i=0;i<data['stopsArray1'].length; i++) {
				data['stopsArray1'][i]['direction_id'] = "1";
				data['stopsArray1'][i]['stop_sequence'] = i+1;
				data['stopsArray1'][i]['id'] = idCounter;
				idCounter ++;
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

		// console.log(tableData);
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
		<div class="scrollbox"><small>${changes || ''}
		(times in UTC)</small></div>

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
			//setTimeout(function(){ $('#routeSaveStatus').html(''); }, 180000);
		},
		error: function(jqXHR, exception) {
			console.log( jqXHR.responseText );
			$('#routeSaveStatus').html(`<p class="alert alert-danger">${jqXHR.responseText}</p>`);
			//setTimeout(function(){ $('#routeSaveStatus').html(''); }, 180000);
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
	
	var fuzzy = 'n';
    if(document.querySelector('#fuzzy').checked) fuzzy = 'y';
	
	$('#routeSuggestStatus').html(`<p class="alert alert-warning">Processing..</p>`);

	$.get( `${APIpath}routeSuggest?route=${globalRoute}&fuzzy=${fuzzy}&key=${globalApiKey}`, function( response ) {
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
	let rowJson = { 'id':element.id, 'direction_id':element.direction_id, 'stop_sequence':element.stop_sequence, 'stop_name':element.stop_name};
	if(element.stop_lat) rowJson['stop_lat'] = parseFloat( String(element.stop_lat).trim() );
	if(element.stop_lon) rowJson['stop_lon'] = parseFloat( String(element.stop_lon).trim() );
	if(element.offset) rowJson['offset'] = element.offset;
	if(element.confidence) rowJson['confidence'] = element.confidence;
	if(element.stop_desc) rowJson['stop_desc'] = element.stop_desc;
	if(element.suggested) rowJson['suggested'] = element.suggested;
	return rowJson;
}

function mapToSelectedRow(lat,lon) {
	console.log('mapToSelectedRow():',lat,lon);
	var selectedRows = routeTable.getSelectedRows(); //$("#left-table").tabulator("getSelectedRows");
	var row = selectedRows[0];
	// row component : https://tabulator.info/docs/3.5#component-row
	row.getCell('stop_lat').setValue(lat);
	row.getCell('stop_lon').setValue(lon);
	row.getCell('confidence').setValue($('#confidenceSelect').val());
	
	mapStops();	
	if(map.hasLayer(lineLayer)) {
		map.removeLayer(lineLayer);
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
}


function mapStops(firstRun=false){

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
			fillOpacity: directionDecideOpacity(stoprow)
		};
		var tooltipContent = `${stoprow.stop_name}`;
		if(stoprow.stop_sequence) tooltipContent = `${stoprow.stop_sequence}:${tooltipContent}`; // prefix sequence
		
		var stopmarker = L.circleMarker([lat,lon], circleMarkerOptions).bindTooltip(tooltipContent, {direction:'right', offset:[10,0]});
		stopmarker.properties = stoprow;
		stopmarker.addTo(stopsLayer);
	}
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
			mapStops(firstRun=false);
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
	var selectedRows = routeTable.getSelectedRows();
	if(selectedRows.length) {
		presentDir = selectedRows[0].getData().direction_id;
		routeTable.addRow({'stop_name': $('#addStop').val(), 'direction_id':presentDir }, false, selectedRows[0]);
	}
	else 
		routeTable.addRow({'stop_name': $('#addStop').val() });
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
	suggestionsHTML = `<a href="javascript:;" onclick="toggleLayer('suggested')">Toggle Auto-suggested locations</a> for stop ${name} :<br>`;
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

	// suggestionsHTML += `<small><a href="javascript:;" onclick="toggleLayer('suggested')">Toggle Suggestions</a></small>`;
	// if( ! map.hasLayer(suggestedLayer) ) map.addLayer(suggestedLayer); // 7.5.19 : Keep this off only, let the user toggle it on.
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
	idCount = 0;
	for(i=0; i< data.length; i++) {
		let stopRow = data[i];
		if(stopRow['direction_id'] == '1') {
			returnCount ++;
			stopRow['stop_sequence'] = returnCount;
		} else {
			onwardCount ++;
			stopRow['stop_sequence'] = onwardCount;
		}
		stopRow['id'] = idCount;
		idCount ++;
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

function loadBanksBackground(data) {
	// 27.4.19: Intervention : parameterizing this
	// how to store in memory : create a global json object on the same lines!
	// from https://stackoverflow.com/a/5737136/4355695 : Object.entries() loops through key-value pairs in a json. Ref: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/entries
	Object.entries(data['databanksList']).forEach(
		([title, filename]) => { 
			console.log('Loading ',title, filename); 

			Papa.parse(`${filename}?_=${globalRandom}`, {
				download: true,
				header: true,
				skipEmptyLines: true,
				complete: function(results, file) {
					// pre-process it a bit if its one of the reports
					if( filename.includes('reports/') ) {
						results.data.forEach(r => {
							r['source'] = `${r['folder']}/${r['jsonFile']}:dir${r['direction_id']}`;
						});
					}
					global_DB[title] = results.data;
					console.log((new Date).getTime(),`${filename} loaded.`);
					document.getElementById('databanks').innerHTML += `<a href="javascript:;" onclick="loadDatabank('${title}')">${title}</a> | `;
				},
				error: function(err, file, inputElem, reason) {
					console.log(`${filename} not found.`);
				}
			});
		}
	);
}

function loadDatabank(src="databank") {
	console.log(`loading ${src} onto the databank table and the map.`);
	// console.log(global_DB[src]);
	databankTable.setData(global_DB[src]);
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

function nextStop(n) {
	var activeRows = routeTable.getData(true);
	var firstID = activeRows[0].id;
	var lastID = activeRows[activeRows.length-1].id;
	console.log('firstID:',firstID,'lastID:',lastID);
	var selectedRows = routeTable.getSelectedRows();
	if(selectedRows.length) {

		routeTable.deselectRow();
		var row = selectedRows[0];
		var nextRow = n>0 ? row.getNextRow() : row.getPrevRow();
		var nextID = 0;
		// if there is a next row, get its id. else loop around
		if(nextRow) nextID = nextRow.getData().id;
		else nextID = n>0 ? firstID : lastID;

		console.log('Next ID:',nextID);
		routeTable.selectRow(nextID);
		routeTable.scrollToRow(nextID, "top", true);
	}
	else { 
		routeTable.selectRow(firstID);
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
	
	
