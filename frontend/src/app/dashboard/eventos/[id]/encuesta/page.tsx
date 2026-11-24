import { EventSurveyResults } from '@/components/events/EventSurvey';
export default function Page({params}:{params:{id:string}}){return <EventSurveyResults id={params.id}/>;}
