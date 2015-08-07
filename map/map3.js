L.mapbox.accessToken = 'pk.eyJ1IjoidG9tdGFuZyIsImEiOiJzYnZ0UDhJIn0.sOskd6PSAysu7Nbo1ma7gg';
var map=L.mapbox.map('map', 'tomtang.k92p5kfe').setView([35.335,103.711],4);
var cities=[];
var markers=[];
var path=[];
var dist=[];
//var polyline=L.polyline([]);
ReadCitiesFromCSV();
//addMarkersFromGeoJson();

var stop=false;

function ReadCitiesFromCSV()
{
    d3.csv("data/City.csv",
        null,
        function callback(err,rows)
        {
            for (var i=0;i<rows.length;i++)
            {
                cities[i]=rows[i];
                cities[i].Latitude=+cities[i].Latitude;
                cities[i].Longitude=+cities[i].Longitude;
                cities[i].Total=+cities[i].Total;
            }
            addMarkers();
            //showPath();
            readPath();
        }
    );
}
function addMarkers()
{
    var city_icon= L.icon({
        iconUrl:'picture/city_icon.jpg',
        iconSize:[15,15]
    });
    for(var i=0;i<cities.length;i++)
    {
        markers[i]=L.marker(
            [+cities[i].Latitude,+cities[i].Longitude],
            {
                icon:city_icon,
                title:cities[i].City,
                riseOnHover:true,
                opacity:0.5
            }
        )
            .addTo(map);
    }
}
function readPath()
{
    d3.csv("data/path_matrix.csv",
        null,
        function(err,rows)
        {
            for(var i=0;i<rows.length;i++)
            {
                path[i]=[];
                //console.log(path[i]);
                for(var j=0;j<rows.length;j++)
                {
                    var s= j.toString();
                    path[i][j]=+rows[i][s];
                }
            }
            //console.log("go");
            readDist();
        }
    );
}
function readDist()
{
    d3.csv(
        "data/dist_matrix.csv",
        null,
        function(err,rows)
        {
            for(var i=0;i<rows.length;i++)
            {
                dist[i]=[];
                for(var j=0;j<rows.length;j++)
                {
                    var s= j.toString();
                    dist[i][j]=+rows[i][s];
                }
            }
            //spread(22);
        }
    )
}
var routes=[];
var multiline=null;
var heatLayer=null;;
/*const infected_icon= L.icon({
    iconUrl:'picture/infected.jpg',
    iconSize:[15,15]
});*/
function changeToInfected(i)
{
    var latlng=[cities[i].Latitude,cities[i].Longitude,cities[i].Total];
    //console.log(latlng);
    //markers[i].setIcon(infected_icon);
    //markers[i].opacity=1.0;
    //markers[i].update();
    //L.circle(latlng,500,{color:"#EE0000",fill:true,fillcolor:"#EE0000",fillopacity:1.0}).addTo(map);
    //var infectedCities=heatLayer.getLatLngs();
    //infectedCities.push(latlng);
    //for (var i=0;i<100;i++)
    heatLayer.addLatLng(latlng);
}
function spread(center)
{
    if(heatLayer!=null)
        map.removeLayer(heatLayer);
    if(multiline!=null)
        map.removeLayer(multiline);
    stop=false;
    var multi=[];
    for(var i=0;i<cities.length;i++)
    {
        multi[i]=[];
        if(i==center)
        continue;
        routes[i]=new Route(center,i);
        routes[i].generateInterCities();
        routes[i].generateTmpRoute();
    }
    heatLayer= L.heatLayer([],{minOpacity:1,max:1000000000000,blur:0,radius:50,gradient:{0.23: '#0D0Dcc', 0.24: 'yellow', 0.25: '#FF0000'}})
    heatLayer.addTo(map);
    changeToInfected(center);
    multiline= L.multiPolyline(multi,{weight:3.5,color:"#EE0000",opacity:0.3});
    multiline.addTo(map);
    spreading(center);
}
function spreading(center)
{
    var multi=multiline.getLatLngs();
    var no_more=true;
    for(var i=0;i<cities.length;i++)
    {
        if(i==center) continue;
        if(routes[i].ct<routes[i].tmpRoute.length)
        {
            multi[i].push(routes[i].tmpRoute[routes[i].ct]);
            routes[i].ct++;
            no_more=false;
        }
        else
        {
            multi[i]=[];
            if(routes[i].nextCity!=routes[i].dest)
            {
                routes[i].generateTmpRoute();
                routes[i].ct=0;
                multi[i].push(routes[i].tmpRoute[routes[i].ct]);
                routes[i].ct++;
                no_more=false;
            }
            else
            {
                changeToInfected(i);
                //markers[i].update();
            }
        }
    }
    multiline.setLatLngs(multi);
    if(!no_more&&!stop)
    {
        setTimeout(function(){spreading(center);},100);
    }
}
//route类
function Route(origin,dest)
{
    this.origin=origin;
    this.dest=dest;
    this.tmpRoute=[];//当前正在传播的两城市之间的临时路径（弧线）（latestCity->nextCity）
    this.interCities=[];//由一个城市到达另一个城市的最短路径上的途经城市编号
    this.nextCity = undefined;//下一到达城市
    this.latestCity=origin;//最近受感染城市
    this.index=-1;//当前传播到的城市在interCities中的下标
    this.ct=0;//当前点在tmpRoute中的下标
    this.generateTmpRoute=function()
    {
        var begin,end;
        if(this.index==-1)
        {
            begin=this.origin;
            this.index++;
            end=this.interCities[this.index];
            this.nextCity=end;
        }
        else
        {
            if(this.index==this.interCities.length)
            {
                this.tmpRoute= [];
                return -1;
            }
            else
            {
                this.latestCity=this.interCities[this.index];
                begin=this.latestCity;
                this.index++;
                this.nextCity=this.interCities[this.index];
                end=this.nextCity;
            }
        }
        //console.log(this.index,begin,end);
        var beginPoint={x:+cities[begin].Longitude,y:+cities[begin].Latitude};
        var endPoint={x:+cities[end].Longitude,y:+cities[end].Latitude};
        var generator = new arc.GreatCircle(beginPoint, endPoint);
        var line = generator.Arc(2*dist[begin][end],{offset:10});
        var obj=line.json();
        var coordinates=obj.geometry.coordinates;
        this.tmpRoute=[];
        for(var p=0;p<coordinates.length;p++)
        {
            this.tmpRoute.push([+coordinates[p][1],+coordinates[p][0]]);
        }
        return 0;
    };
    this.generateInterCities=function()
    {
        pPath(this.interCities,this.origin,this.dest);
        this.interCities.push(this.dest);
    };
    function pPath(array,i,j)
    {
        var k=path[i][j];
        if(k==-1)
        return;
        else
        {
            pPath(array,i,k);
            array.push(k);
            pPath(array,k,j);
        }
    }
}
var selectedCenter=0;
function selectOnChange(obj)
{
    selectedCenter=obj.options[obj.options.selectedIndex].value;
}

function pause()
{
    stop=true;
}
function goOn()
{
    stop=false;
    spreading(selectedCenter);
}
function clearLayer()
{
    stop=true;
    if(heatLayer!=null)
        map.removeLayer(heatLayer);
    if(multiline!=null)
        map.removeLayer(multiline);
}