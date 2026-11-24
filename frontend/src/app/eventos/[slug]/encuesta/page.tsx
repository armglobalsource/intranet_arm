import { EventSurveyForm } from '@/components/events/EventSurvey';
export default function Page({params}:{params:{slug:string}}){return <EventSurveyForm slug={params.slug}/>;}
