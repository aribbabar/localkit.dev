# Poorly Formatted Code Snippets Dataset

This file contains intentionally poorly formatted snippets for testing code formatters.

---

# JavaScript / TypeScript

## JavaScript

    function greet(name){if(name){console.log("hello "+name)}else{console.log("hello stranger")}}greet("John")

    function processUsers(users,options){let result=[];for(let i=0;i<users.length;i++){let u=users[i];if(u&&u.active==true){let score=0;if(u.age>18){score+=10}else{score-=5}if(u.orders&&u.orders.length>0){for(let j=0;j<u.orders.length;j++){let order=u.orders[j];if(order.status=="completed"){score+=order.total>100?20:5}else if(order.status=="pending"){score+=1}else{score-=2}if(order.items){for(let k=0;k<order.items.length;k++){let item=order.items[k];if(item.category=="electronics"){score+=3}else if(item.category=="books"){score+=1}else{score+=0}if(item.discount&&item.discount>0){score+=2}}}}}let tier="basic";if(score>50){tier="gold"}else if(score>25){tier="silver"}else if(score>10){tier="bronze"}let summary={id:u.id,name:u.name,email:u.email?toupperEmail(u.email):null,score:score,tier:tier,lastLogin:u.lastLogin?new Date(u.lastLogin).toISOString():null,meta:{region:u.address&&u.address.city?u.address.city:"unknown",newsletter:u.preferences&&u.preferences.newsletter?true:false,tags:u.tags?u.tags.join(","):""}};if(options&&options.includeInactive==true||summary.score>0){result.push(summary)}}}if(options&&options.sortBy=="score"){result.sort(function(a,b){return b.score-a.score})}else if(options&&options.sortBy=="name"){result.sort(function(a,b){if(a.name<b.name){return-1}else if(a.name>b.name){return 1}else{return 0}})}let grouped={gold:[],silver:[],bronze:[],basic:[]};for(let x=0;x<result.length;x++){let r=result[x];if(!grouped[r.tier]){grouped[r.tier]=[]}grouped[r.tier].push(r)}return{count:result.length,data:result,grouped:grouped,generatedAt:new Date().toString()}}
    function toupperEmail(email){return email.split("@")[0].toUpperCase()+"@"+email.split("@")[1]}
    function fetchDashboardData(api,cb){api.get("/users",function(err,res){if(err){cb({ok:false,message:"failed to fetch users",error:err});return}api.get("/settings",function(err2,settings){if(err2){cb({ok:false,message:"failed to fetch settings",error:err2});return}let processed=processUsers(res.data,{sortBy:settings.sortBy,includeInactive:false});let stats={total:processed.count,goldUsers:processed.grouped.gold.length,silverUsers:processed.grouped.silver.length,bronzeUsers:processed.grouped.bronze.length,basicUsers:processed.grouped.basic.length,topUser:processed.data.length>0?processed.data[0]:null};let html="";for(let i=0;i<processed.data.length;i++){let u=processed.data[i];html+="<div class='card'>"+"<h3>"+u.name+"</h3>"+"<p>"+u.email+"</p>"+"<span>"+u.tier+"</span>"+"</div>"}cb({ok:true,stats:stats,html:html,raw:processed})})})}
    const app={state:{loading:false,data:null,error:null,filters:{search:"",tier:"all"}},init:function(api){this.state.loading=true;fetchDashboardData(api,(response)=>{if(response.ok){this.state.data=response;this.render()}else{this.state.error=response.message;console.log("Error:",response.error)}this.state.loading=false})},render:function(){if(!this.state.data){document.body.innerHTML="<h1>No data</h1>";return}let list=this.state.data.raw.data;let output="";for(let i=0;i<list.length;i++){if(this.state.filters.tier!="all"&&list[i].tier!=this.state.filters.tier){continue}if(this.state.filters.search!=""&&!list[i].name.toLowerCase().includes(this.state.filters.search.toLowerCase())){continue}output+="<section><header>"+list[i].name+"</header><article>"+list[i].email+"</article><footer>"+list[i].score+" - "+list[i].tier+"</footer></section>"}document.getElementById("app").innerHTML=output},updateFilter:function(key,value){this.state.filters[key]=value;this.render()}}
    setTimeout(function(){console.log("App booting...");if(typeof window!="undefined"){window.fakeApi={get:function(url,cb){if(url=="/users"){cb(null,{data:[{id:1,name:"Alice",email:"alice@example.com",active:true,age:29,lastLogin:"2024-01-02",orders:[{status:"completed",total:120,items:[{category:"electronics",discount:10},{category:"books"}]}],preferences:{newsletter:true},address:{city:"New York"},tags:["vip","beta"]},{id:2,name:"Bob",email:"bob@example.com",active:true,age:17,lastLogin:null,orders:[{status:"pending",total:20,items:[{category:"games"}]}],preferences:{newsletter:false},address:{city:"Chicago"},tags:["new"]},{id:3,name:"Charlie",email:"charlie@example.com",active:false,age:45,orders:[],preferences:{newsletter:true},address:{city:"Austin"},tags:[]} ]})}else if(url=="/settings"){cb(null,{sortBy:"score"})}else{cb("Unknown endpoint")}}};app.init(window.fakeApi)}},500)

## JSX

    const App=()=>{return <div><h1>Hello</h1><button onClick={()=>{alert("clicked")}}>Click</button></div>}

## TypeScript

    function add(a:number,b:number){let result=a+b;return result}const total=add(5,10);console.log(total)

## TSX

    type Props={title:string}
    export default function Header(props:Props){return <div><h1>{props.title}</h1></div>}

## Flow

    // @flow
    function multiply(a:number,b:number){return a*b}const result=multiply(3,4);console.log(result)

## JavaScript (clang)

    var nums=[1,2,3,4];nums.forEach(function(n){if(n%2===0){console.log("even",n)}else{console.log("odd",n)}})

---

# Markup

## Angular

    <div *ngIf="user"><h2>{{user.name}}</h2><button (click)="logout()">Logout</button></div>

## Vue

    <template><div><p>{{message}}</p><button @click="count++">Clicked {{count}}</button></div></template><script>export default{data(){return{message:"hello",count:0}}}</script>

## HTML

    <html><head><title>Test</title></head><body><div><h1>Title</h1><p>paragraph</p></div></body></html>

## Handlebars / Ember

    <div>{{#if user}}<h2>{{user.name}}</h2>{{else}}<p>No user</p>{{/if}}</div>

---

# Styles

## CSS

    body{margin:0;padding:0;background:#fff}h1{color:red;font-size:20px}p{line-height:1.5}

## Less

    @color:red;#header{color:@color;.nav{margin:0;padding:0}}

## SCSS

    $primary:blue;.container{h1{color:$primary}p{margin:0}}

---

# Data / Config

## JSON

    {"name":"John","age":30,"skills":["js","python","sql"],"active":true}

## GraphQL

    query{user(id:1){id name email posts{title}}}

## YAML

    user: {name: John, age: 30, active: true, skills: [js, python, sql]}

## Protobuf

    syntax="proto3";message User{string name=1;int32 age=2;repeated string skills=3;}

## JSON (clang)

    {"config":{"enabled":true,"timeout":5000,"hosts":["a.com","b.com"]}}

---

# Prose

## Markdown

    #Title
    Some text with **bold** and *italic*
    - item1
    - item2
    [link](https://example.com)

## MDX

    import Button from "./Button"
    # Hello
    <Button onClick={()=>alert("hi")}>Click</Button>

---

# C / C++

## C

    #include<stdio.h>
    int main(){int i;for(i=0;i<5;i++){printf("%d\n",i);}return 0;}

## C++

    #include<iostream>
    using namespace std;int main(){for(int i=0;i<5;i++){cout<<i<<endl;}return 0;}

## Objective-C

    #import <Foundation/Foundation.h>
    int main(){@autoreleasepool{NSLog(@"Hello world");}return 0;}

---

# JVM / .NET

## Java

    public class Main{public static void main(String[]args){for(int i=0;i<5;i++){System.out.println(i);}}}

## C#

    using System;class Program{static void Main(){for(int i=0;i<5;i++){Console.WriteLine(i);}}}
