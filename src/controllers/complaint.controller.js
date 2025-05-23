import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js"
import { ApiResponse } from "../utils/ApiResponse.js";
import { Complaint } from "../models/complaint.model.js";
import { Student } from "../models/student.model.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";

const getComplaintsAndFeedbacks = asyncHandler(async(req, res) => {
    const complaints = await Complaint.find().populate('studentId','name rollNo');
    return res.status(200).json(
        new ApiResponse(200, complaints, "Complaints and Feedbacks fetched successfully")
    )
});

const getComplaintOrFeedback = asyncHandler(async(req, res) => {
    const complaint = await Complaint.findById(req.params.id).populate('studentId', 'name rollNo');
    if (!complaint) {
        throw new ApiError(404, "Complaint or Feedback not found")
    }
    return res.status(200).json(
        new ApiResponse(200, complaint, "Complaint or Feedback fetched successfully")
    )
});

const getComplaints = asyncHandler(async(req, res) => {
    const complaints = await Complaint.find({category: 'Complaint'}).populate('studentId','name rollNo');
    return res.status(200).json(
        new ApiResponse(200, complaints, "Complaints fetched successfully")
    )
});

const getFeedbacks = asyncHandler(async(req, res) => {
    const complaints = await Complaint.find({category: 'Feedback'}).populate('studentId','name rollNo');
    return res.status(200).json(
        new ApiResponse(200, complaints, "Feedbacks fetched successfully")
    )
});

const addComplaint = asyncHandler(async(req, res) => {
    const { category, title, description } = req.body;
    let attachments = [];

    if (!title || !description || !category) {
        throw new ApiError(400, "All fields are required")
    }

    console.log(req.files);

    if(req.files){
        for(let i = 0; i < req.files.length; i++){
            const { path } = req.files[i];
            const image = await uploadOnCloudinary(path)
            attachments.push(image.secure_url);
        }
    }

    const student = await Student.findById(req.student._id);
    const complaint = await Complaint.create({ category, title, description, studentId: student._id, attachments });

    if (!complaint) {
        throw new ApiError(500, "Error while adding complaint/Feedback")
    }

    return res.status(201).json(
        new ApiResponse(201, complaint, "Complaint/Feedback added successfully")
    )
});

const updateComplaint = asyncHandler(async(req, res) => {
    const status = req.body.status;

    const comment = {
        adminId: req.admin._id,
        comment: req.body.comment   
    }

    if (!comment && !status) {
        throw new ApiError(400, "Either update the status or add a comment");
    }

    const complaint = await Complaint.findById(req.params.id);

    if (!complaint) {
        throw new ApiError(404, "Complaint/Feedback not found")
    }

    if (status) {
        complaint.status = status;
        if(status == 'resolved'){
            complaint.resolvedAt = new Date();
        }
    }

    if (comment) {
        complaint.comments.push(comment);
    }

    await complaint.save();

    return res.status(200).json(
        new ApiResponse(200, complaint, "Complaint/Feedback updated successfully")
    )
});

const deleteComplaint = asyncHandler(async(req, res) => {
    const complaint = await Complaint.findById(req.params.id);
    if (!complaint) {
        throw new ApiError(404, "Complaint/Feedback not found")
    }

    await complaint.deleteOne();

    return res.status(200).json(
        new ApiResponse(200, {}, "Complaint deleted successfully")
    )
});

export {
    getComplaints,
    getComplaintsAndFeedbacks,
    getComplaintOrFeedback,
    getFeedbacks,
    addComplaint,
    updateComplaint,
    deleteComplaint
}