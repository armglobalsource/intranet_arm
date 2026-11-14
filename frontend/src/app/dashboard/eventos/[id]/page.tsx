import { EventEditor } from '@/components/events/EventEditor';
export default function Page({params}:{params:{id:string}}){return <EventEditor id={params.id}/>;}
