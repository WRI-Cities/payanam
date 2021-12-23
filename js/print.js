// print.js

// ######################################
/* GLOBAL VARIABLES */
const stopIconSize = [20, 20];
var URLParams = {}; // for holding URL parameters
var globalRoute = '';

var baseLayer = [L.layerGroup(null), L.layerGroup(null)];
var stopsLayer = [L.geoJson(null), L.geoJson(null) ];
var lineLayer = [L.geoJson(null), L.geoJson(null) ];

var globalLineCollector = [[],[]];
// #################################
/* MAPs */
// background layers, using Leaflet-providers plugin. See https://github.com/leaflet-extras/leaflet-providers
var base = {
"CartoDB Positron": [ L.tileLayer.provider('CartoDB.Positron'), L.tileLayer.provider('CartoDB.Positron') ],
"CartoDB Voyager": [ L.tileLayer.provider('CartoDB.VoyagerLabelsUnder'), L.tileLayer.provider('CartoDB.VoyagerLabelsUnder') ],

"OpenStreetMap": [ L.tileLayer.provider('OpenStreetMap.Mapnik') , L.tileLayer.provider('OpenStreetMap.Mapnik')],
"Esri WorldTopoMap": [ L.tileLayer.provider('Esri.WorldTopoMap') , L.tileLayer.provider('Esri.WorldTopoMap')],
"Esri WorldGrayCanvas": [ L.tileLayer.provider('Esri.WorldGrayCanvas') , L.tileLayer.provider('Esri.WorldGrayCanvas')],

"gStreets": [ L.tileLayer('https://{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}',{maxZoom: 20, subdomains:['mt0','mt1','mt2','mt3']}) , L.tileLayer('https://{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}',{maxZoom: 20, subdomains:['mt0','mt1','mt2','mt3']})],
"gHybrid": [ L.tileLayer('https://{s}.google.com/vt/lyrs=s,h&x={x}&y={y}&z={z}',{maxZoom: 20, subdomains:['mt0','mt1','mt2','mt3']}) , L.tileLayer('https://{s}.google.com/vt/lyrs=s,h&x={x}&y={y}&z={z}',{maxZoom: 20, subdomains:['mt0','mt1','mt2','mt3']})],
"gSat": [ L.tileLayer('https://{s}.google.com/vt/lyrs=s&x={x}&y={y}&z={z}',{maxZoom: 20,subdomains:['mt0','mt1','mt2','mt3']}) , L.tileLayer('https://{s}.google.com/vt/lyrs=s&x={x}&y={y}&z={z}',{maxZoom: 20,subdomains:['mt0','mt1','mt2','mt3']})],


"Stamen Toner": [ L.tileLayer.provider('Stamen.Toner'), L.tileLayer.provider('Stamen.Toner') ],
"Stamen Toner-Lite": [ L.tileLayer.provider('Stamen.TonerLite'), L.tileLayer.provider('Stamen.TonerLite') ],
"Stamen Watercolor": [ L.tileLayer.provider('Stamen.Watercolor'), L.tileLayer.provider('Stamen.Watercolor') ],
"Stamen Terrain": [ L.tileLayer.provider('Stamen.Terrain'), L.tileLayer.provider('Stamen.Terrain') ]
};
const defaultBase = "CartoDB Positron";

/*
var map = [
    new L.Map('map0', { layers: [base["MBlight"][0]], center: STARTLOCATION, zoom: STARTZOOM, scrollWheelZoom: true, maxZoom: 18, zoomControl: false, preferCanvas: true }),
    new L.Map('map1', { layers: [base["MBlight"][1]], center: STARTLOCATION, zoom: STARTZOOM, scrollWheelZoom: true, maxZoom: 18, zoomControl: false, preferCanvas: true }),
];
*/
var map = [null,null];


for(var dir=0;dir<2;dir++) {
    map[dir] = new L.Map(`map${dir}`, { layers: [base["CartoDB Positron"][dir]], center: STARTLOCATION, zoom: STARTZOOM, scrollWheelZoom: true, maxZoom: 18, zoomControl: false, zoomDelta: 0.1, zoomSnap:0.1 });
    L.control.scale({position: 'bottomleft'}).addTo(map[dir])
    L.control.zoom({position: 'bottomleft'}).addTo(map[dir]);
    baseLayer[dir].addTo(map[dir]);
    stopsLayer[dir].addTo(map[dir]);
    lineLayer[dir].addTo(map[dir]);

    // Leaflet.Control.Custom : add custom HTML elements
    // see https://github.com/yigityuce/Leaflet.Control.Custom
    L.control.custom({
        position: 'topright',
        content: `
        <h4><span class="routeInfo">Click "Options" and pick a route</span></h4>
    
        <div class="collapse hide" id="collapse_settings${dir}">
        ${dir?'':'<p>Select a route: <select id="jsonSelect"></select></p>'}
        <p>Change page dimensions:<br>
        Width:<input class="width" size="5" value="1000" type="number" min="100" max="10000" step="10">px, 
        Height:<input class="height" size="5" value="1450" type="number" min="100" max="10000" step="10">px<br>
        Map part:<input class="ratio" size="5" value="69" type="number" min="20" max="100" step="1">% &nbsp;&nbsp;
        <button onclick="changeDimensions(${dir})">Apply</button>
        &nbsp; | &nbsp; 
        <a onclick="changeDimensions(${dir},true)" href="javascript:;">Reset</a></p>
    
        <!--Presets: <a>A4</a> | <a>A3</a> | <a>A2</a> | <a>A1</a>-->
        </p>
        <p>Change background: <select class="background"></select> </p>
        <p>Change color: <input class="color" value="black" size="8">, font:<input class="fontColor" value="white" size="8">  <button onclick="changeColor(${dir})">Apply</button></p>
    
        </div>
        <div style="float:left;" class="no-print"><a data-toggle="collapse" href="#collapse_settings${dir}" role="button" aria-expanded="false" aria-controls="collapse_settings${dir}">>> Options</a></div>
        <div style="float:right;" class="no-print">
        <a onclick="zoomFit(${dir})" href="javascript:;">Fit map to Route</a> | 
        <a onclick="window.print()" href="javascript:;">Print</a>
        </div>
      `,
        classes: `divOnMap1`
    }).addTo(map[dir]);
    
    L.control.custom({
        position: 'topleft',
        content: `<span class="fromTo"></span>`,
        classes: `divOnMap1`
    }).addTo(map[dir]);
    
} // end of 0-1 loop for covering both directions

$('.leaflet-container').css('cursor','crosshair'); // from https://stackoverflow.com/a/28724847/4355695 Changing mouse cursor to crosshairs
// SVG renderer
var myRenderer = L.canvas({ padding: 0.5 });



// #####################################################################
// RUN ON PAGE LOAD

$(document).ready(function() {
	
	$.ajaxSetup({ cache: false }); // from https://stackoverflow.com/a/13679534/4355695 to force ajax to always load from source, don't use browser cache. This prevents browser from loading old route jsons.
    loadDefaults();
    loadJsonsList();

    $('#jsonSelect').on('change', function (e) {
		if( this.value == '') { 
			return;
		}
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
    }

    /*$('#dims').on('change', function (e) {
        setDimensions(this.value);
    });*/

    bgChoices();

    $('.dir0 .background').on('change', function (e) {
        console.log(this.value);
        var destination = this.value; // need to copy this over, as "this.value" doesn't make it to inside the next loop
        if( ! this.value) return;
        baseLayer[0].clearLayers();
        base[destination][0].addTo(baseLayer[0]);
    });
    $('.dir1 .background').on('change', function (e) {
        console.log(this.value);
        var destination = this.value; // need to copy this over, as "this.value" doesn't make it to inside the next loop
        if( ! this.value) return;
        baseLayer[1].clearLayers();
        base[destination][1].addTo(baseLayer[1]);
    });


});

//#####################################
// API Call functions
function loadJsonsList() {
    $.get( `${APIpath}loadJsonsList?hideExt=Y`, function( data ) {
        console.log('GET request loadJsonsList successful.');
        $('#jsonSelect').html(data);
        $('#jsonSelect').trigger('chosen:updated'); 
        $('#jsonSelect').chosen({disable_search_threshold: 1, search_contains:true, width:200, placeholder_text_single:'Pick a route'});
	}).fail(function(err) {
        // fallback: if not on API path, load CSV
		loadRoutesCSV();
	});
}

function loadRoutesCSV() {
    // alternative to loadJsonsList() function, for payanam-lite
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
            $('#jsonSelect').html(returnHTML);
            $('#jsonSelect').trigger('chosen:updated'); 
            $('#jsonSelect').chosen({disable_search_threshold: 1, search_contains:true, width:200, placeholder_text_single:'Pick a route'});
        }
    });
}

// ############################################
// JS FUNCTIONS

function loadJson() {
	if(globalRoute == '') return;

	// clearEverything(loaderText='loading...');
    console.log('loadJson():',globalRoute);


	$.getJSON(`routes/${globalRoute}`, function(data) {
        // console.log(data);
        // gotta render!
        $('#jsonSelect').val(globalRoute);
        $('#jsonSelect').trigger('chosen:updated');
        let depot = globalRoute.split('/')[0];
        $('.routeInfo').html(`Depot: ${depot} | Route: ${data.routeName}`);
        // change page title
        document.title = `Depot ${depot}, Route ${data.routeName}`;

        for(dir=0;dir<2;dir++) {
            stopsLayer[dir].clearLayers();
            var stopsArray = data[`stopsArray${dir}`] || [];

            mappedList = stopsArray.filter(a => ! isNaN(parseFloat(a.stop_lat)));
            // filters down to mapped stops only
            // console.log(mappedList);
            
            globalLineCollector[dir] = []; // this is a global variable now
            var listHTML = '';
            var fromStop = '', toStop = '';
            mappedList.forEach(function(stoprow,i) {
                if(i==0) fromStop = stoprow.stop_name;
                if(i+1 == mappedList.length) toStop = stoprow.stop_name;

                let lat = parseFloat(stoprow['stop_lat']);
                let lon = parseFloat(stoprow['stop_lon']);
                
                if( ! checklatlng(lat,lon) ) {
                    console.log('Skipping a stop because of invalid values:', stopsjson[stoprow]);
                    return;
                }
                globalLineCollector[dir].push([lat,lon]);
                listHTML += `<li>${i+1}. ${stoprow.stop_name}</li>`; // populate stops list
                var tooltipContent = `${i+1}: ${stoprow.stop_name}`;
                var tooltipOptions = {permanent:false, direction:'right', offset:[20,0] };
                var stopmarker = L.marker([lat,lon], { 
                    icon: L.divIcon({
                        className: `stop-divicon${dir}`,
                        iconSize: stopIconSize,
                        html: ( parseInt(i)+1 )
                    }) 
                })
                .bindTooltip(tooltipContent,tooltipOptions);
                stopmarker.properties = stoprow;
                stopmarker.addTo(stopsLayer[dir]);
                map[dir].fitBounds(stopsLayer[dir].getBounds(), {padding:[20,20], maxZoom:15});

            }); // end of mappedList loop

            drawLine(dir);
            //console.log(listHTML);
            var dirLabel = dir? 'Down':'Up';
            $(`.dir${dir} .stopsList`).html(listHTML);
            $(`.dir${dir} .fromTo`).html(`<h5 align="left">${fromStop} to<br>${toStop}<br>(${dirLabel})</h5>`);
            if(data[`timeStructure_${dir}`]) {
                var timings = data[`timeStructure_${dir}`]['trip_times'];
                if( (timings.constructor === Array) && timings.length)
                    $(`.dir${dir} .timings`).html(`Trip start times: ${data[`timeStructure_${dir}`]['trip_times'].join(', ')}`);
            }
        } // end of dir 0,1 loop
        
        if(data['serviceNumbers']) if(data['serviceNumbers'].length) $(`.service`).html(`Service numbers: ${data['serviceNumbers'].join(', ')}`); // show service numbers if present.

        // L.tooltipLayout.initialize(map0, null); // feature discarded 
    }); // end of getJSON
}

function bgChoices() {
    var content = '';
    Object.entries(base).forEach(
        ([key, value]) => {
            if( key == defaultBase)
                content += `<option selected>${key}</option>`;
            else content += `<option>${key}</option>`;
        }
    );
    $('.background').html(content);
}

function changeDimensions(dir,reset=false) {

    var w = parseInt($(`.dir${dir} .width`).val());
    var h = parseInt($(`.dir${dir} .height`).val());
    var ratio = parseFloat($(`.dir${dir} .ratio`).val());

    if(reset) {
        w = 1000; $(`.dir${dir} .width`).val(w);
        h = 1450; $(`.dir${dir} .height`).val(h);
        ratio = 69; $(`.dir${dir} .ratio`).val(ratio);
    }

    $(`.page.dir${dir}`).css('width',`${w}px`);
    
    let mapH = parseInt( (h*ratio/100).toFixed(0));
    let stopsH = h - mapH;
    $(`.dir${dir} .map`).css('height',`${mapH}px`);
    $(`.dir${dir} .stopsPart`).css('height',`${stopsH}px`);
    console.log(w,h,mapH,stopsH);

    // there, that resizes the map.

        map[0].invalidateSize();
        // from https://stackoverflow.com/questions/24412325/resizing-a-leaflet-map-on-container-resize 
        //Checks if the map container size changed and updates the map if so — call it after you've changed the map size dynamically
        
        map[0].fitBounds(stopsLayer[0].getBounds(), {padding:[5,5], maxZoom:17});
        console.log(stopsLayer[0].getBounds());
    
}

function downloadURI( img, name) {
	var link = document.createElement("a");
	link.download = name;
	link.href = `data:${img}`;
	link.click();
	link.remove();
}


function printMap() {
    //Render internally as image here itself so that even without saving as image, the image is ready for sending to backend server.
    // https://html2canvas.hertzen.com/getting-started
    // https://stackoverflow.com/a/33669243/4355695 but syntax of the trigger function updated.
    html2canvas(document.querySelector('.page'),{ useCORS: true}).then(function(canvas) {
        var img = canvas.toDataURL("image/png");
        downloadURI(img, 'test.png');
    });
}

function changeColor(dir) {
    var color = $(`.dir${dir} .color`).val();
    var fontColor = $(`.dir${dir} .fontColor`).val();
    lineLayer[dir].setStyle( {color:color} );
    console.log(`dir:${dir}, color:${color}, fontColor:${fontColor}`);

    $(`.stop-divicon${dir}`).css('background-color',color);
    $(`.stop-divicon${dir}`).css('color',fontColor);
    // re-do setText for arrows
    drawLine(dir,color);
    /*
    var spacer = Array(3).join(" "); // repeater. from https://stackoverflow.com/a/1877479/4355695
    lineLayer[0].setText(spacer+'>'+spacer, {repeat: true, offset: 6, attributes: {'font-weight': 'bold', 'font-size': '18', 'fill':color}}) // ►
    */

}

function drawLine(dir=0, color='black') {
    lineLayer[dir].clearLayers();
    var polyOptions = { color:color };
    var poly = L.polyline(globalLineCollector[dir], polyOptions);
    let spacer = Array(3).join(" "); // repeater. from https://stackoverflow.com/a/1877479/4355695
    // putting arrows. See https://github.com/makinacorpus/Leaflet.TextPath
    poly.setText(spacer+'>'+spacer, {repeat: true, offset: 6, attributes: {'font-weight': 'bold', 'font-size': '18', 'fill':color}}); // ►
    poly.addTo(lineLayer[dir]);
    
}

function zoomFit(dir=0) {
    map[dir].fitBounds(stopsLayer[dir].getBounds(), {padding:[5,5], maxZoom:17});
}
