import { Component, Output, EventEmitter } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';

export interface TimelineEntry {
  day: string; month: string; docId: number; name: string;
  type: string; amount: string; status: 'done'|'upcoming'|'urgent'; icon: string; color: string;
}

@Component({ selector:'app-timeline', standalone:true, imports:[CommonModule], templateUrl:'./timeline.component.html', styleUrls:['./timeline.component.scss'] })
export class TimelineComponent {
  @Output() closed  = new EventEmitter<void>();
  @Output() openDoc = new EventEmitter<{id:number,tab:string}>();

  months = [
    { label:'April 2026', entries:[
      { day:'1',  month:'Apr', docId:4, name:'Invoice_DesignServices_March2026.pdf', type:'Invoice',          amount:'$4,500',   status:'upcoming', icon:'📄', color:'#fff7ed' },
      { day:'15', month:'Apr', docId:0, name:'PAYOFF STATEMENT_0184316123_0.PDF',     type:'Payoff Statement', amount:'$284,510', status:'upcoming', icon:'💰', color:'#fef2f2' },
    ]},
    { label:'March 2026', entries:[
      { day:'10', month:'Mar', docId:2, name:'Chase_Bank_Statement_Feb2026.pdf',       type:'Bank Statement',  amount:'$12,440',  status:'done',     icon:'🏦', color:'#dbeafe' },
      { day:'8',  month:'Mar', docId:3, name:'1040_Tax_Return_2024.pdf',               type:'Tax Document',    amount:'$1,840',   status:'done',     icon:'🧾', color:'#fce7f3' },
    ]},
    { label:'February 2026', entries:[
      { day:'28', month:'Feb', docId:5, name:'Chase_Credit_Card_Jan2026.pdf',          type:'Credit Card',     amount:'$3,218',   status:'done',     icon:'💳', color:'#ecfdf5' },
      { day:'14', month:'Feb', docId:6, name:'W2_2024_Eliassen_Group.pdf',             type:'Tax Document',    amount:'$128,400', status:'done',     icon:'🧾', color:'#fce7f3' },
    ]},
    { label:'July 2026 — Upcoming', entries:[
      { day:'1',  month:'Jul', docId:11,name:'AutoInsurance_Renewal_2026.pdf',         type:'Insurance',       amount:'$1,284',   status:'upcoming', icon:'🚗', color:'#eff6ff' },
    ]},
  ];
}
