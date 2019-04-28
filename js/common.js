// common.js

// CONSTANTS
const APIpath = 'API/';
const STARTLOCATION = [17.390491,78.484102]; //Hyderabad
const STARTLOCATIONjson = {lat: 17.390491, lng: 78.484102};
const STARTZOOM = 10;
const MBaccessToken = 'pk.eyJ1IjoibmlraGlsc2hldGgiLCJhIjoiQTREVlJuOCJ9.YpMpVVbkxOFZW-bEq1_LIw';
const mapillaryClientID = 'OEotQm9EOW9KX25wczJGaWxjUy1ldzozY2FlNzVmYmU4NjAwZmVk';

const confidence_options = { // used in stage 4 - route mapping
    "1":"1-Just picked one from suggested", 
    "2":"2-Estimated from looking at map", 
    "3":"3-Did some searching, arrived at this", 
    "4":"4-I remember having been here",
    "5":"5-Dot! I know this stop is here for sure" 
};

// brought from routeMap.js:
const databankColor = '#dde88f';
const stopOnwardColor = 'green'
const stopReturnColor = 'purple';
const suggestedColor = 'blue';

// Colors to use in allMap.html page. from http://phrogz.net/css/distinct-colors.html
const phrogzColors = ["#ff0000", "#bfa98f", "#8fbf96", "#00294d", "#eabfff", "#e50000", "#736556", "#00f241", "#1d4b73", "#9d7ca6", "#a60000", "#b27700", "#004011", "#b6d6f2", "#d600e6", "#f23d3d", "#664400", "#3df285", "#738799", "#912699", "#bf6060", "#f2b63d", "#43594c", "#004cbf", "#de73e6", "#7f4040", "#ccaa66", "#16593a", "#668fcc", "#590053", "#e6acac", "#594a2d", "#0d3321", "#1d3473", "#664d64", "#997373", "#332f26", "#73e6b0", "#80a2ff", "#330029", "#8c3123", "#7f6600", "#bfffe1", "#b6c6f2", "#ff40d9", "#ff9180", "#403300", "#698c7c", "#4d5366", "#4d2645", "#402420", "#f2da79", "#008c5e", "#4059ff", "#e60099", "#594643", "#7f7340", "#60bfac", "#131b4d", "#a6297c", "#591800", "#bfb68f", "#00f2e2", "#1a1d33", "#d96cb5", "#401100", "#fff240", "#008c83", "#0000ff", "#7f0044", "#d96236", "#b2aa2d", "#10403d", "#0000cc", "#8c466c", "#d9896c", "#535900", "#336663", "#3030bf", "#f2b6d6", "#7f5140", "#eef2b6", "#8fbfbc", "#737399", "#4d3944", "#cca799", "#c2f200", "#00e2f2", "#110080", "#f23d85", "#ff6600", "#2b330d", "#00add9", "#aaa3d9", "#4c132a", "#a64200", "#cfe673", "#1d6273", "#110040", "#997382", "#ff8c40", "#6d7356", "#13414d", "#341d73", "#66001b", "#66381a", "#739926", "#79daf2", "#a280ff", "#400011", "#402310", "#74d900", "#566d73", "#3e394d", "#992645", "#e5a173", "#628040", "#00aaff", "#3e2d59", "#bf6079", "#ffd9bf", "#315916", "#002b40", "#7400d9", "#663341", "#995200", "#b2ff80", "#297ca6", "#660099", "#cc3347", "#ffa640", "#d0ffbf", "#262f33", "#75468c", "#ff8091", "#a67f53", "#29a63a", "#0058a6", "#2b1a33"];

// GLOBAL VARIABLES
var globalApiKey = '';
var mapillaryLayer = new L.geoJson(null);
var defaults = {};

//tabulator custom formatter icon definition
var printIcon = function(cell, formatterParams, onRendered){ return `<img src="lib/route.svg" height="20" width="20">`;
};

var unMapIcon = function(cell, formatterParams, onRendered){ 
    return `<img src="lib/un_map.svg" height="20" width="20">`;
};

// Leaflet map setup - common stuff
/*
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
*/

// ###########################################################
// RUN ON PAGE LOAD
$(document).ready(function() {
    
    topMenu();

    // initiate bootstrap / jquery components like tabs, accordions
    // initiate accordion
    $( "#accordion" ).accordion({
        collapsible: true, active: false
    });
    
	// tabs
	$( "#tabs" ).tabs({
		active:0
    });
    // tooltips:
    $('[data-toggle="tooltip"]').tooltip(); 
    
    // run authentication / API key handler:
    checkCookie();
    
});

// ###########################################################
// FUNCTIONS


function checklatlng(lat,lon) {
	if ( typeof lat == 'number' && 
		typeof lon == 'number' &&
		!isNaN(lat) &&
		!isNaN(lon) ) {
		//console.log(lat,lon,'is valid');
		return true;
	}
	else {
		//console.log(lat,lon,'is not valid');
		return false;
	}
}


// hiding and showing elements, including their screen real estate. from https://stackoverflow.com/a/51113691/4355695
function hide(el) {
    el.style.visibility = 'hidden';	
  return el;
}

function show(el) {
  el.style.visibility = 'visible';	
  return el;
}

//#####################################
// COOKIES
// from https://www.w3schools.com/js/js_cookies.asp

function setCookie(cname, cvalue, exdays) {
    var d = new Date();
    d.setTime(d.getTime() + (exdays*24*60*60*1000));
    var expires = "expires="+ d.toUTCString();
    document.cookie = cname + "=" + cvalue + ";" + expires + ";path=/";
  }
  
function getCookie(cname) {
    var name = cname + "=";
    var decodedCookie = decodeURIComponent(document.cookie);
    var ca = decodedCookie.split(';');
    for(var i = 0; i <ca.length; i++) {
        var c = ca[i];
        while (c.charAt(0) == ' ') {
            c = c.substring(1);
        }
        if (c.indexOf(name) == 0) {
        return c.substring(name.length, c.length);
        }
    }
    return "";
}

function checkCookie(change=false) {
    globalApiKey = getCookie("apikey");

    if(change) globalApiKey = prompt("Please enter your API Key, or put in 'guest':");

    console.log(globalApiKey);

    if( !globalApiKey ) {
        globalApiKey = 'guest';
    }

    // presumably we reach here only with a valid apikey value.
    
    $.get( `${APIpath}keyCheck?key=${globalApiKey}`, function( response ) {
        var userData = JSON.parse(response);
        console.log(userData);
        globalName = userData.name;
        globalEmail = userData.email;
        globalAccess = userData.access;
        setCookie("apikey", globalApiKey, 3); // last argument : days
        $('#keyStatus').html(`Logged in as ${globalName}, ${globalEmail}, access level: ${globalAccess}. <small><button onclick="checkCookie(true)">Change user</button></small>`);
    }).fail(function(err) {
        console.log('keyCheck GET call failed.', err.responseText);
        $('#keyStatus').html(err.responseText + '<small><button onclick="checkCookie(true)">Change user</button></small>');
    });
    
    //alert("Welcome again. Your api key is: " + globalApiKey + '\nClear your cookies to use another one.');
    
}

function topMenu() {
    var menu = `
    <nav class="navbar navbar-expand-lg navbar-light bg-light">
  <a class="navbar-brand" href="#">Payanam</a>
  <button class="navbar-toggler" type="button" data-toggle="collapse" data-target="#navbarSupportedContent" aria-controls="navbarSupportedContent" aria-expanded="false" aria-label="Toggle navigation">
    <span class="navbar-toggler-icon"></span>
  </button>

  <div class="navbar-collapse" id="navbarSupportedContent">
    <ul class="navbar-nav mr-auto">
      <li class="nav-item">
        <a class="nav-link" href="index.html">Overview</a>
      </li>
      <li class="nav-item">
        <a class="nav-link" href="routeEntry.html">Data-Entry</a>
      </li>
      <li class="nav-item">
        <a class="nav-link" href="routeMap.html">Route Mapper</a>
      </li>

      <li class="nav-item">
        <a class="nav-link" href="timings.html">Timings</a>
      </li>
      <li class="nav-item">
      <a class="nav-link" href="reconciliation.html">Stops Reconciliation</a>
      </li>
      <li class="nav-item">
      <a class="nav-link" href="allMap.html">Map</a>
      </li>

    </ul>
    <span class="navbar-text"><small>
      <a id="versionNum" href="https://github.com/WRI-Cities/payanam" target="_blank"></a> | <a href="admin.html">Admin</a>
    </small></span>
  </div>
</nav>
    `;
    $('#topMenu').html(menu);
}

function directionDecide(stoprow) {
    // moved here from routeMap.js
	if( (stoprow.direction_id) && (stoprow.direction_id == '1') )  return stopReturnColor;
	else return stopOnwardColor;
}

function openExternalMap(site='m'){
    // 22.2.19: moved here from routeMap.js
	let lat = map.getCenter().lat;
	let lon = map.getCenter().lng;
	let zoom = map.getZoom();
  var url = '';

	if (site == 'g')
		url = `https://maps.google.com/maps?q=${lat},${lon}+(My+Point)&z=${zoom}&ll=${lat},${lon}`;
	// from https://webapps.stackexchange.com/a/54163/162017 
	
	else if (site == 'p') {
    let fromStamp = '1420070400000'; // from 2015-01-01
    url = `http://projets.pavie.info/pic4carto/index.html?from=${fromStamp}#${zoom}/${lat}/${lon}`;
  }
  
  else 
    url = `https://www.mapillary.com/app/?lat=${lat}&lng=${lon}&z=17`;
		
	console.log(url);
	var win = window.open(url, '_blank');
}


function loadDepots() {
    var filename = 'databank/depots.csv';
    console.log(filename);
    Papa.parse(`${filename}?_=${(new Date).getTime()}`, {
		download: true,
		header: true,
		skipEmptyLines: true,
		complete: function(results, file) {
			//console.log("Parsing complete:", results, file);
            results.data.forEach(element => {
                let lat = parseFloat(element.latitude);
                let lon = parseFloat(element.longitude);

                if(!checklatlng(lat,lon)) {
                    console.log('depots layer: invalid coords:',element);
                    return;
                }
                var circleMarkerOptions = {
                    renderer: myRenderer,
                    radius: 5,
                    fillColor: 'magenta',
                    color: 'black',
                    weight: 0.5,
                    opacity: 1,
                    fillOpacity: 0.5
                };
                var tooltipContent = `Depot: ${element.depot_code}<br>${element.name}`;
                var stopmarker = L.circleMarker([lat,lon], circleMarkerOptions)
                    .bindTooltip(tooltipContent, {
                        direction:'top', 
                        offset: [0,-5]
                });
                stopmarker.addTo(depotsLayer);

            });
            if (!map.hasLayer(depotsLayer)) map.addLayer(depotsLayer);
		}
	});
}

function openMapillary(searchRadius=1000) {
	// to do: create an iframe in id:mapillary
	// changing iframe location: document.getElementById('iframeID').src="http://google.com/";
	
	let lat = map.getCenter().lat;
	let lon = map.getCenter().lng;
	
	// https://a.mapillary.com/v3/images?client_id=${mapillaryClientID}&closeto=78.47029,17.33073&radius=1000
	var url = `https://a.mapillary.com/v3/images?client_id=${mapillaryClientID}&closeto=${lon},${lat}&radius=${searchRadius}`;
	$('#mapillaryStatus').html('Loading..');
	$.getJSON(url, function(data) {
		console.log(data);
		if (! data.features.length) {
			$('#mapillaryStatus').html('No photos found in last call.');
			return;
		}
		let firstImage = data.features[0].properties.key;
		console.log(firstImage);
		document.getElementById('mapillary').src=`https://embed-v1.mapillary.com/embed?version=1&filter=%5B%22all%22%5D&map_filter=%5B%22all%22%5D&map_style=osm&image_key=${firstImage}&x=0.49999999999999994&y=0.49999999999999994&client_id=${mapillaryClientID}&style=split`;
		
		$('#mapillaryStatus').html(`Loaded ${data.features.length} photos within ${Math.round(searchRadius/1000)}km.`);

		// directly on the map?
		mapillaryLayer.clearLayers();

		var circleMarkerOptions = {
			renderer: myRenderer,
			radius: 4,
			fillColor: 'brown',
			color: 'black',
			weight: 0.5,
			opacity: 0.5,
			fillOpacity: 0.5
		};

		// from https://leafletjs.com/examples/geojson/ 
		L.geoJson(data, {
			pointToLayer: function (feature, latlng) {
				return L.circleMarker(latlng, circleMarkerOptions);
			},
			onEachFeature: function (feature, layer) {
				if (feature.properties && feature.properties.key) {
					layer.bindPopup(`<a href="https://d1cuyjsrcm0gby.cloudfront.net/${feature.properties.key}/thumb-2048.jpg" target="_blank"><img src="https://d1cuyjsrcm0gby.cloudfront.net/${feature.properties.key}/thumb-320.jpg" width="160" height="120"></a>`);
				}
			}
        }).addTo(mapillaryLayer);
        if (!map.hasLayer(mapillaryLayer)) map.addLayer(mapillaryLayer);
	}).fail(function(d) {
		$('#mapillaryStatus').html('API call failed.');
	}); // end of getJSON

}

function loadDefaults(callbackFlag=false, callbackFunc=null) {
    $.getJSON('config/config.json', function(data) {
        defaults = data;
        $('#defaultSpeed').html(data['timeDefaults']['defaultSpeed']);
        $('#versionNum').html(data['version']);

        // if a callback function has been given, then on json load, execute that function passing the json data as argument.
        if(callbackFlag) callbackFunc(data); 
    });

}

// #########################
// GRAYEYARD

/*
function keyCheck() {
    //globalApiKey
    if(change) 
        globalApiKey = prompt();
    $.get( `${APIpath}keyCheck?key=${globalApiKey}`, function( response ) {
        var userData = JSON.parse(response);
        console.log(userData);
        globalName = userData.name;
        globalEmail = userData.email;
    }).fail(function(err) {
		console.log('keyCheck GET call failed.', err.responseText);
	});

}
*/
