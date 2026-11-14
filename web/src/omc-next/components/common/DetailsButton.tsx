import React from "react";
import { Ellipsis } from "lucide-react";
import { ToolButton } from "./ToolButton";
export function DetailsButton(props:{onClick:()=>void;disabled?:boolean}){return <ToolButton {...props} icon={<Ellipsis size={16}/>} label="详情 / Details"/>;}
