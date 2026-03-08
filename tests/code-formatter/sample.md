# Poorly Formatted Code Snippets Dataset

This file contains intentionally poorly formatted snippets for testing code formatters.

---

# JavaScript / TypeScript

## JavaScript

    function greet(name){if(name){console.log("hello "+name)}else{console.log("hello stranger")}}greet("John")

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
