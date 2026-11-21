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

type Purpose = 'avatar' | 'visual-reference' | 'feedback' | 'event-cover';
const EVENT_COVER_TYPES: Record<string, string> = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp' };

/** Revisa la firma del archivo: el tipo declarado no basta. */
export function looksLikeImage(buffer: Buffer, contentType: string) {
  if (contentType === 'image/jpeg') return buffer.length > 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  if (contentType === 'image/png') return buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  if (contentType === 'image/webp') return buffer.subarray(0, 4).toString('ascii') === 'RIFF' && buffer.subarray(8, 12).toString('ascii') === 'WEBP';
  return false;
}
export class UploadTicketDto {
  @IsIn(['avatar', 'visual-reference', 'feedback', 'event-cover']) purpose: Purpose;
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
    if (purpose === 'event-cover' && !['eventos:manageAll', 'eventos:manageCampus', 'eventos:organize'].some((p) => hasPermission(user.permissions ?? [], p))) throw new ForbiddenException();
  }

  @Post('ticket')
  async ticket(@Body() dto: UploadTicketDto, @CurrentUser() user: any) {
    this.authorize(dto.purpose, user, dto.userId);
    const formats = dto.purpose === 'avatar'
      ? ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic', 'image/heif']
      : dto.purpose === 'visual-reference'
      ? ['image/jpeg', 'image/png', 'image/webp', 'image/gif'] : Object.keys(EVENT_COVER_TYPES);
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

  /** Portada de un evento: queda en el almacenamiento público y se devuelve su URL. */
  @Post('event-cover/complete')
  async eventCover(@Body() dto: CompleteUploadDto, @CurrentUser() user: any) {
    const { claims, file } = await this.read(dto.ticket, 'event-cover', user);
    try {
      if (!looksLikeImage(file.buffer, claims.contentType)) throw new BadRequestException('El archivo no es una imagen JPG, PNG o WebP válida');
      const url = await this.storage.uploadPublic(`event-covers/${user.sub}-${Date.now()}-${randomUUID().slice(0, 8)}${EVENT_COVER_TYPES[claims.contentType]}`, file.buffer, claims.contentType);
      return { url };
    } finally {
      await this.storage.discardUpload(claims.key);
    }
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
