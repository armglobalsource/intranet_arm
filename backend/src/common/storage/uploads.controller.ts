import { BadRequestException, Body, Controller, ForbiddenException, Post } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { randomUUID } from 'node:crypto';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min, ValidateNested } from 'class-validator';
import { CurrentUser } from '../decorators/current-user.decorator';
import { hasPermission } from '../permissions';
import { StorageService } from './storage.service';
import { PostgresUsersService } from '../../users/postgres-users.service';
import { PostgresVisualReferencesService } from '../../visual-references/postgres-visual-references.service';
import { PostgresFeedbackService } from '../../feedback/postgres-feedback.service';
import { CreateVisualReferenceDto } from '../../visual-references/dto/visual-reference.dto';
import { CreateFeedbackDto } from '../../feedback/dto/feedback.dto';

type Purpose = 'avatar' | 'visual-reference' | 'feedback';
export class UploadTicketDto {
  @IsIn(['avatar', 'visual-reference', 'feedback']) purpose: Purpose;
  @IsString() @MaxLength(100) contentType: string;
  @IsInt() @Min(1) @Max(10 * 1024 * 1024) size: number;
  @IsOptional() @IsInt() @Min(1) userId?: number;
}
export class CompleteUploadDto {
  @IsString() @MaxLength(2048) ticket: string;
}
export class CompleteVisualDto extends CompleteUploadDto {
  @ValidateNested() @Type(() => CreateVisualReferenceDto) metadata: CreateVisualReferenceDto;
}
export class CompleteFeedbackDto extends CompleteUploadDto {
  @ValidateNested() @Type(() => CreateFeedbackDto) metadata: CreateFeedbackDto;
}

// Auth, current permissions, account status and throttling are global guards.
@Controller({ path: 'uploads', version: '1' })
export class UploadsController {
  constructor(private storage: StorageService, private jwt: JwtService,
    private users: PostgresUsersService, private visuals: PostgresVisualReferencesService,
    private feedback: PostgresFeedbackService) {}

  private authorize(purpose: Purpose, user: any, userId?: number) {
    if (purpose === 'avatar' && (!userId || (userId !== Number(user.sub) && !hasPermission(user.permissions ?? [], 'users:edit')))) throw new ForbiddenException();
    if (purpose === 'visual-reference' && !hasPermission(user.permissions ?? [], 'visual-references:manage')) throw new ForbiddenException();
  }

  @Post('ticket')
  async ticket(@Body() dto: UploadTicketDto, @CurrentUser() user: any) {
    this.authorize(dto.purpose, user, dto.userId);
    const formats = dto.purpose === 'avatar'
      ? ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic', 'image/heif']
      : dto.purpose === 'visual-reference'
      ? ['image/jpeg', 'image/png', 'image/webp', 'image/gif'] : ['image/jpeg', 'image/png', 'image/webp'];
    if (!formats.includes(dto.contentType) || (dto.purpose !== 'avatar' && dto.size > 5 * 1024 * 1024)) throw new BadRequestException('Formato o tamaño de archivo no permitido');
    if (dto.purpose === 'avatar') await this.users.findOne(dto.userId!);
    const key = `${user.sub}/${randomUUID()}`;
    const signedUrl = await this.storage.createUploadUrl(key);
    const ticket = await this.jwt.signAsync({ ...dto, sub: Number(user.sub), key }, {
      audience: 'arm-upload', issuer: 'arm-api', expiresIn: '10m', algorithm: 'HS256',
    });
    return { signedUrl, ticket };
  }

  private async read(ticket: string, purpose: Purpose, user: any) {
    let claims: UploadTicketDto & { sub: number; key: string };
    try { claims = await this.jwt.verifyAsync(ticket, { audience: 'arm-upload', issuer: 'arm-api', algorithms: ['HS256'] }); }
    catch { throw new ForbiddenException('La autorización de carga venció o no es válida'); }
    if (claims.sub !== Number(user.sub) || claims.purpose !== purpose) throw new ForbiddenException();
    this.authorize(purpose, user, claims.userId);
    const buffer = await this.storage.readUpload(claims.key, claims.size);
    return { claims, file: { buffer, mimetype: claims.contentType, size: buffer.length } as Express.Multer.File };
  }

  @Post('avatar/complete')
  async avatar(@Body() dto: CompleteUploadDto, @CurrentUser() user: any) {
    const { claims, file } = await this.read(dto.ticket, 'avatar', user);
    const result = await this.users.uploadAvatar(claims.userId!, file);
    await this.storage.discardUpload(claims.key);
    return result;
  }

  @Post('visual-reference/complete')
  async visual(@Body() dto: CompleteVisualDto, @CurrentUser() user: any) {
    if (!dto.metadata) throw new BadRequestException('Faltan los datos de la imagen');
    const { claims, file } = await this.read(dto.ticket, 'visual-reference', user);
    const result = await this.visuals.create(dto.metadata, file, user.sub, user.name ?? user.email);
    await this.storage.discardUpload(claims.key);
    return result;
  }

  @Post('feedback/complete')
  async report(@Body() dto: CompleteFeedbackDto, @CurrentUser() user: any) {
    if (!dto.metadata) throw new BadRequestException('Faltan los datos del reporte');
    const { claims, file } = await this.read(dto.ticket, 'feedback', user);
    const name = `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim() || user.email;
    const result = await this.feedback.create(dto.metadata, user.sub, name, user.email, file.buffer, file.mimetype);
    await this.storage.discardUpload(claims.key);
    return result;
  }
}
