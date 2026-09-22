import { Booking } from "../models/Booking.js";
import Joi from "joi";

// TODO: write a validation schema for create/update per README.md section 2.
const createSchema = Joi.object({
  roomNumber: Joi.string().min(1).required(),
  startDate: Joi.date().required().less(Joi.ref("endDate")),
  endDate: Joi.date().required(),
  purpose: Joi.string(),
  bookedBy: Joi.string(),
});

const updateSchema = Joi.object({
  roomNumber: Joi.string().min(1),
  startDate: Joi.date().less(Joi.ref("endDate")),
  endDate: Joi.date(),
  purpose: Joi.string,
  bookedBy: Joi.string().hex().length(24),
});

function publicBooking(b) {
  return {
    id: b._id.toString(),
    roomNumber: b.roomNumber,
    startDate: b.startDate,
    endDate: b.endDate,
    purpose: b.purpose,
    bookedBy: b.bookedBy
      ? {
          id: b.bookedBy._id.toString(),
          name: b.bookedBy.name,
          email: b.bookedBy.email,
        }
      : null,
  };
}

// TODO: per README.md section 4, you will need a way to detect whether a
// proposed booking conflicts with an existing one on the same room.

// GET /api/bookings
// TODO: implement per README.md section 3.
export async function getAllBookings(req, res, next) {
  try {
    const bookings = await Booking.find()
      .populate("bookedBy", "name email")
      .sort({ createdAt: -1 })
      .lean();
    res.json({ bookings: bookings.map(publicBooking) });
  } catch (err) {
    next(err);
  }
}

// GET /api/bookings/:id
// TODO: implement per README.md sections 3 and 5.
export async function getBooking(req, res, next) {
  try {
    const booking = await Booking.findById(req.params.id).populate(
      "bookedBy",
      "name email",
    );

    if (!booking) return res.status(404).json({ message: "booking not found" });
    res.json({ booking: publicBooking(booking) });
  } catch (err) {
    next(err);
  }
}

async function checkConflict(value, excludeId = null) {
  const query = {
    roomNumber: value.roomNumber,
    startDate: { $lt: value.endDate },
    endDate: { $gt: value.startDate },
  };
  if (excludeId) {
    query._id = { $ne: excludeId }; // so a booking doesn't "conflict" with itself on update
  }
  return Booking.findOne(query);
}

// POST /api/bookings
// TODO: implement per README.md sections 3 and 4.
export async function createBooking(req, res, next) {
  try {
    const { value, error } = createSchema.validate(req.body);
    if (error) return res.status(400).json({ message: error.message });

    const conflict = await checkConflict(value);
    if (conflict) {
      return res
        .status(409)
        .json({ message: "booking conflicts with an existing booking" });
    }

    const booking = await Booking.create(value);
    res.status(201).json({ booking: publicBooking(booking) });
  } catch (err) {
    next(err);
  }
}

// PATCH /api/bookings/:id
// TODO: implement per README.md sections 3, 4, and 5.
export async function updateBooking(req, res, next) {
  try {
    const { value, error } = createSchema.validate(req.body);
    if (error) return res.status(400).json({ message: error.message });

    const existing = await Booking.findById(req.params.id);
    if (!existing)
      return res.status(404).json({ message: "booking not found" });

    const merged = {
      roomNumber: value.roomNumber ?? existing.roomNumber,
      startDate: value.startDate ?? existing.startDate,
      endDate: value.endDate ?? existing.endDate,
    };

    const conflict = await checkConflict(merged, req.params.id);
    if (conflict) {
      return res
        .status(409)
        .json({ message: "booking conflicts with an existing booking" });
    }

    const doc = await Booking.findByIdAndUpdate(req.params.id, value, {
      new: true,
      runValidators: true,
    });
    res.json({ booking: publicBooking(doc) });
  } catch (err) {
    next(err);
  }
}

// DELETE /api/bookings/:id
// TODO: implement per README.md sections 3 and 5.
export async function deleteBooking(req, res, next) {
  try {
    const doc = await Booking.findByIdAndDelete(req.params.id);
    if (!doc) return res.status(404).json({ message: "Booking not found" });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
}
