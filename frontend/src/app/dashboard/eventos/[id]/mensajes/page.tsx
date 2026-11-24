import { EventMessages } from '@/components/events/EventMessages';
export default function Page({params}:{params:{id:string}}){return <EventMessages id={params.id}/>;}
