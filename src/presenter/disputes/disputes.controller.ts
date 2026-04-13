import {
    BadRequestException,
    Body,
    Controller,
    Get,
    NotFoundException,
    Param,
    Post,
    Req,
    Res,
    UploadedFile,
    UseGuards,
    UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { existsSync, mkdirSync } from 'node:fs';
import { extname, join } from 'node:path';
import type { Request, Response } from 'express';
import { DisputesService } from './disputes.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { CreateDisputeDto } from './dto/create-dispute.dto';
import { VoteDto } from './dto/vote.dto';

const videoEvidenceExt = new Set(['.mp4', '.mov', '.m4v', '.webm']);
const imageEvidenceExt = new Set(['.jpg', '.jpeg', '.png', '.webp']);
const allowedEvidenceExt = new Set([...videoEvidenceExt, ...imageEvidenceExt]);

const disputeEvidenceUploadDir = () => {
    const configured = (process.env.UPLOAD_DISPUTE_EVIDENCE_DIR || '').trim();
    const relative = configured || 'uploads/disputes';
    return join(process.cwd(), relative);
};

const ensureDisputeEvidenceUploadDir = () => {
    const dir = disputeEvidenceUploadDir();
    if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
    }
    return dir;
};

const disputeEvidenceStorage = diskStorage({
    destination: (_req, _file, cb) => {
        cb(null, ensureDisputeEvidenceUploadDir());
    },
    filename: (_req, file, cb) => {
        const originalExt = extname(file.originalname || '').toLowerCase();
        const safeExt = allowedEvidenceExt.has(originalExt) ? originalExt : '.mp4';
        const uniqueId = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
        cb(null, `dispute-evidence-${uniqueId}${safeExt}`);
    },
});

const disputeEvidenceFileFilter = (_req: any, file: any, cb: any) => {
    const originalExt = extname(file?.originalname || '').toLowerCase();
    if (allowedEvidenceExt.has(originalExt)) {
        cb(null, true);
        return;
    }
    cb(new BadRequestException('Unsupported evidence file format'), false);
};

@Controller('disputes')
export class DisputesController {
    constructor(private disputesService: DisputesService) { }

    @Get('evidence/:fileName')
    getEvidenceFile(@Param('fileName') fileName: string, @Res() res: Response) {
        const safeFileName = (fileName || '').trim();
        if (!/^[A-Za-z0-9._-]+$/.test(safeFileName)) {
            throw new NotFoundException('Evidence file not found');
        }

        const fullPath = join(disputeEvidenceUploadDir(), safeFileName);
        if (!existsSync(fullPath)) {
            throw new NotFoundException('Evidence file not found');
        }

        return res.sendFile(fullPath);
    }

    @Post('evidence/upload')
    @UseGuards(JwtAuthGuard)
    @UseInterceptors(
        FileInterceptor('file', {
            storage: disputeEvidenceStorage,
            fileFilter: disputeEvidenceFileFilter,
            limits: {
                fileSize: 100 * 1024 * 1024,
            },
        }),
    )
    async uploadEvidence(
        @CurrentUser() _user: any,
        @UploadedFile() file: any,
        @Req() req: Request,
    ) {
        if (!file?.filename) {
            throw new BadRequestException('Evidence file is required');
        }

        const ext = extname(file.filename || '').toLowerCase();
        const type = videoEvidenceExt.has(ext) ? 'VIDEO' : 'PHOTO';
        const url = this.buildEvidenceUrl(req, file.filename);

        return {
            success: true,
            url,
            type,
            thumbnailUrl: type === 'PHOTO' ? url : null,
        };
    }

    @Post()
    @UseGuards(JwtAuthGuard)
    async createDispute(@CurrentUser() user: any, @Body() dto: CreateDisputeDto) {
        return this.disputesService.createDispute(user.userId, dto);
    }

    @Get('jury-duty')
    @UseGuards(JwtAuthGuard)
    async getJuryDuty(@CurrentUser() user: any) {
        return this.disputesService.getJuryDuty(user.userId);
    }

    @Get('my')
    @UseGuards(JwtAuthGuard)
    async getMyDisputes(@CurrentUser() user: any) {
        return this.disputesService.getMyDisputes(user.userId);
    }

    @Get(':id')
    @UseGuards(JwtAuthGuard)
    async getDispute(@Param('id') disputeId: string, @CurrentUser() user: any) {
        return this.disputesService.getDisputeById(disputeId, user.userId);
    }

    @Post(':id/vote')
    @UseGuards(JwtAuthGuard)
    async vote(
        @Param('id') disputeId: string,
        @CurrentUser() user: any,
        @Body() dto: VoteDto,
    ) {
        return this.disputesService.vote(disputeId, user.userId, dto);
    }

    private buildEvidenceUrl(req: Request, fileName: string) {
        const configuredBase = (process.env.PUBLIC_BASE_URL || '')
            .trim()
            .replace(/\/$/, '');
        const requestBase = `${req.protocol}://${req.get('host')}`.replace(/\/$/, '');
        const baseUrl = configuredBase || requestBase;
        return `${baseUrl}/api/disputes/evidence/${encodeURIComponent(fileName)}`;
    }
}
