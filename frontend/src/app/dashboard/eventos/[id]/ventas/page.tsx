import { EventSales } from '@/components/events/EventSales';
export default function Page({params}:{params:{id:string}}){return <EventSales id={params.id}/>;}
