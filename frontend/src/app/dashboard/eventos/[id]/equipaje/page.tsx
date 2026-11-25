import { EventLuggage } from '@/components/events/EventLuggage';
export default function Page({params}:{params:{id:string}}){return <EventLuggage id={params.id}/>;}
