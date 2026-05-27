import { IsString, IsEnum, IsOptional, MinLength, MaxLength } from 'class-validator';

export class CreateFeedbackDto {
  @IsEnum(['bug', 'suggestion']) type: 'bug' | 'suggestion';
  @IsString() @MinLength(5) @MaxLength(2000) message: string;
  @IsOptional() @IsString() screenshotUrl?: string;
}

export class UpdateFeedbackStatusDto {
  @IsEnum(['open', 'in_progress', 'resolved']) status: 'open' | 'in_progress' | 'resolved';
  @IsOptional() @IsString() @MaxLength(500) note?: string;
}
