import { Article } from "../models/article.model.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { ArticleSharing } from "../models/articleSharing.model.js";
import axios from 'axios';
import fs from 'fs/promises';
import path from 'path';
import http from 'http';
import https from 'https';
import poppler from 'pdf-poppler';

const __dirname = path.dirname('public');

const getArticleSharings = asyncHandler(async(req, res) => {
    const articleSharings = await ArticleSharing.find();
    return res.status(200).json(
        new ApiResponse(200, articleSharings, "Article Sharings fetched successfully")
    )
});

const getArticleSharing = asyncHandler(async(req, res) => {
    const articleSharing = await ArticleSharing.findById(req.params.id);
    if (!articleSharing) {
        throw new ApiError(404, "Article Sharing not found")
    }
    return res.status(200).json(
        new ApiResponse(200, articleSharing, "Article Sharing fetched successfully")
    )
});

const getArticleSharingsByDOI = asyncHandler(async(req, res) => {
    const DOI = req.query.DOI;
    const articleSharings = await ArticleSharing.find({DOI: DOI});
    return res.status(200).json(
        new ApiResponse(200, articleSharings, "Article Sharings fetched successfully")
    )
});

const getArticleSharingsByStudent = asyncHandler(async(req, res) => {
    const student = req.student;
    const studentId = student._id;
    const articleSharings = await ArticleSharing.find({studentId: studentId});
    return res.status(200).json(
        new ApiResponse(200, articleSharings, "Article Sharings fetched successfully")
    )
});

const requestArticle = asyncHandler(async(req, res) => {
    const { DOI, title, authors, journal, publicationYear, additionalInfo } = req.body;

    if(!DOI || !title){
        throw new ApiError(400, "DOI and Title are required")
    }

    const studentId = req.student._id;
    const articleSharing = await ArticleSharing.create({ DOI, title, authors, journal, publicationYear, additionalInfo, studentId: studentId, requestedAt: new Date() });

    if (!articleSharing) {
        throw new ApiError(500, "Error while requesting article")
    }

    return res.status(201).json(
        new ApiResponse(201, articleSharing, "Article requested successfully")
    )
});

const approveArticleRequest = asyncHandler(async(req, res) => {
    const { id, expiryDays } = req.body;    
    const articleSharing = await ArticleSharing.findById(id);
    if (!articleSharing) {
        throw new ApiError(404, "Article Sharing not found")
    }
    if (articleSharing.status === "shared"){
        throw new ApiError(400, "Article is already shared");
    }
    const DOI = articleSharing.DOI;
    const article = await Article.findOne({ DOI: DOI });
    if (!article) {
        throw new ApiError(404, "Article not found")
    }

    articleSharing.sharedAt = new Date();
    articleSharing.validTill = new Date(new Date().getTime() + expiryDays * 24 * 60 * 60 * 1000);
    articleSharing.status = "shared";
    articleSharing.link = `${process.env.STUDENT_URL}/article/${articleSharing._id}`;
    await articleSharing.save();

    return res.status(200).json(
        new ApiResponse(200, articleSharing, "Article request approved successfully")
    )
});

const updateArticleRequest = asyncHandler(async(req, res) => {
    const { id, expiryDays } = req.body;    
    const articleSharing = await ArticleSharing.findById(id);
    if (!articleSharing) {
        throw new ApiError(404, "Article Sharing not found")
    }
    const status = articleSharing.status;
    if(status !== "shared"){
        throw new ApiError(400, "Article is not shared yet")
    }
    const currentTime = new Date();
    if (currentTime > articleSharing.validTill) {
        throw new ApiError(400, "Article sharing has expired")
    }
    const expiryDate = new Date(new Date().getTime() + expiryDays * 24 * 60 * 60 * 1000);
    articleSharing.validTill = expiryDate;
    await articleSharing.save();

    return res.status(200).json(
        new ApiResponse(200, articleSharing, "Article request updated successfully")
    )
});

const rejectArticleRequest = asyncHandler(async(req, res) => {
    const { id } = req.body;
    const articleSharing = await ArticleSharing.findById(id);
    if (!articleSharing) {
        throw new ApiError(404, "Article Sharing not found")
    }

    if(articleSharing.status === "shared"){
        throw new ApiError(400, "Article is already shared");
    }

    articleSharing.status = "rejected";
    await articleSharing.save();
    
    return res.status(200).json(
        new ApiResponse(200, articleSharing, "Article request rejected successfully")
    )
});

const deleteArticleRequest = asyncHandler(async(req, res) => {
    const { id } = req.params;
    const articleSharing = await ArticleSharing.findById(id);
    if (!articleSharing) {
        throw new ApiError(404, "Article Sharing not found")
    }

    await articleSharing.deleteOne();

    return res.status(200).json(
        new ApiResponse(200, {}, "Article request deleted successfully")
    );
});

const viewArticle = asyncHandler(async(req, res) => {
    const { id, page = 1 } = req.query;
    const articleSharing = await ArticleSharing.findById(id);
    if (!articleSharing) {
        throw new ApiError(404, "Article Sharing not found")
    }

    const studentId = req.student._id;

    if (articleSharing.studentId.toString() !== studentId.toString()) {
        throw new ApiError(403, "You are not authorized to view this article")
    }

    const currentTime = new Date();
    if (currentTime > articleSharing.validTill) {
        throw new ApiError(400, "Article sharing has expired")
    }

    const article = await Article.findOne({ DOI: articleSharing.DOI });
    if (!article) {
        throw new ApiError(404, "Article not found")
    }

    const pdfPath = article.link;
    
    if (req.query.stream === 'true') {
        
        if (pdfPath.startsWith('http')) {
            const protocol = pdfPath.startsWith('https') ? https : http;
            
            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', `inline; filename="${article.title.replace(/[^a-zA-Z0-9]/g, '_')}.pdf"`);

            res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
            res.setHeader('Pragma', 'no-cache');
            res.setHeader('Expires', '0');

            protocol.get(pdfPath, (response) => {
                response.pipe(res);
            }).on('error', (err) => {
                throw new ApiError(500, "Error streaming PDF content");
            });
        } else {
            try {
                const fullPath = path.resolve(pdfPath);
                const stat = fs.statSync(fullPath);
                
                res.setHeader('Content-Length', stat.size);
                res.setHeader('Content-Type', 'application/pdf');
                res.setHeader('Content-Disposition', `inline; filename="${article.title.replace(/[^a-zA-Z0-9]/g, '_')}.pdf"`);
                
                res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
                res.setHeader('Pragma', 'no-cache');
                res.setHeader('Expires', '0');
                
                const readStream = fs.createReadStream(fullPath, { highWaterMark: 64 * 1024 });
                readStream.pipe(res);
            } catch (error) {
                throw new ApiError(500, "Error accessing PDF file");
            }
        }
    } else if (req.query.page) {
        const pageNum = parseInt(page, 10);
        try {
            const pageImage = await renderPdfPageToImage(pdfPath, pageNum);
            
            res.setHeader('Content-Type', 'image/png');

            res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
            res.setHeader('Pragma', 'no-cache');
            res.setHeader('Expires', '0');
            
            return res.send(pageImage);
        } catch (error) {
            console.error('Error rendering PDF page:', error);
            throw new ApiError(500, "Failed to render PDF page");
        }
    } else {
        const pdfMetadata = await getPdfMetadata(pdfPath);
        
        return res.status(200).json(
            new ApiResponse(200, {
                article: {
                    title: article.title,
                    authors: article.authors,
                    journal: article.journal,
                    year: article.year,
                    DOI: article.DOI,
                    abstract: article.abstract,
                    pageCount: pdfMetadata.pageCount || 0,
                    streamUrl: `/api/article/view?id=${id}&stream=true`,
                    pageUrl: `/api/article/view?id=${id}&page=`
                }
            }, "Article metadata fetched successfully")
        );
    }
});

let finalPdfPath;

async function renderPdfPageToImage(pdfPath, pageNumber = 1, options = {}) {
    let isTempFile = false;
    let outputPath = null;
    try {
      if (!pdfPath) throw new Error('No PDF path provided');
      if (typeof pageNumber !== 'number' || pageNumber < 1) {
        throw new Error('Invalid page number');
      }
  
       finalPdfPath = pdfPath;

      if (pdfPath.startsWith('http')) {
        const response = await axios.get(pdfPath, { 
          responseType: 'arraybuffer',
          validateStatus: status => status >= 200 && status < 300
        });
        finalPdfPath = path.join(__dirname, `temp-${Date.now()}.pdf`);
        await fs.writeFile(finalPdfPath, response.data);
        isTempFile = true;
      }
      if (!(await fs.stat(finalPdfPath)).isFile()) {
        throw new Error(`PDF file not found: ${finalPdfPath}`);
      }
      const outputPrefix = path.join(__dirname, 'temp-render');
      const opts = {
        format: 'png',
        out_dir: path.dirname(outputPrefix),
        out_prefix: path.basename(outputPrefix),
        page: pageNumber,
        scale: options.dpi || 2000,
        singleFile: true
      };
  
      await poppler.convert(finalPdfPath, opts);

      if (isTempFile) await fs.unlink(finalPdfPath);

      outputPath = `${outputPrefix}-${pageNumber}.png`;
      const imageBuffer = await fs.readFile(outputPath);
      await fs.unlink(outputPath);
  
      return imageBuffer;
  
    } catch (error) {
      if (isTempFile) await fs.unlink(finalPdfPath).catch(() => {});
      await fs.unlink(outputPath).catch(() => {});
      
      console.error(`PDF rendering error: ${error.message}`);
      throw error;
    }
  }
  async function getPdfMetadata(pdfPath) {
    let isTempFile = false;
    try {
      let finalPdfPath = pdfPath;

      if (pdfPath.startsWith('http')) {
        const response = await axios.get(pdfPath, { 
          responseType: 'arraybuffer',
          validateStatus: status => status >= 200 && status < 300
        });
        finalPdfPath = path.join(__dirname, `temp-meta-${Date.now()}.pdf`);
        await fs.writeFile(finalPdfPath, response.data);
        isTempFile = true;
      }

      const info = await poppler.info(finalPdfPath);
      const stats = await fs.stat(finalPdfPath);
  
      if (isTempFile) await fs.unlink(finalPdfPath);
  
      return {
        pageCount: parseInt(info.pages, 10),
        title: info.title || null,
        author: info.author || null,
        fileSize: stats.size
      };
  
    } catch (error) {
      console.error('Error extracting PDF metadata:', error);
      return {
        pageCount: 0,
        title: null,
        author: null
      };
    }
  }

export {
    getArticleSharings,
    getArticleSharing,
    getArticleSharingsByDOI,
    getArticleSharingsByStudent,
    requestArticle,
    approveArticleRequest,
    updateArticleRequest,
    rejectArticleRequest,
    deleteArticleRequest,
    viewArticle
}