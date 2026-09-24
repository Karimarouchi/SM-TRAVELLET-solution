const messages = require("../repositories/messageRepository");
const students = require("../repositories/studentRepository");
const users = require("../repositories/userRepository");

function fail(message, status = 400) {
  const error = new Error(message);
  error.status = status;
  throw error;
}

function mapConversation(row) {
  return {
    id: row.id,
    studentId: row.student_id,
    salesId: row.sales_id,
    studentName: `${row.student_prenom} ${row.student_nom}`.trim(),
    salesName: `${row.sales_prenom} ${row.sales_nom}`.trim(),
    studentAvatarUrl: row.student_avatar_url || "",
    salesAvatarUrl: row.sales_avatar_url || "",
    lastBody: row.last_body || "",
    lastAt: row.last_at || row.updated_at,
    unread: row.unread || 0
  };
}

function mapMessage(row) {
  return {
    id: row.id,
    conversationId: row.conversation_id,
    senderId: row.sender_id,
    senderName: `${row.sender_prenom} ${row.sender_nom}`.trim(),
    senderRole: row.sender_role,
    senderAvatarUrl: row.sender_avatar_url || "",
    body: row.body,
    createdAt: row.created_at
  };
}

function canView(auth, conversation) {
  if (auth.role === "ADMIN") return true;
  if (auth.role === "STUDENT") return conversation.student_id === auth.sub;
  if (auth.role === "SALES") return conversation.sales_id === auth.sub;
  return false;
}

async function canSend(auth, conversation) {
  if (auth.role === "ADMIN") return true;
  if (auth.role === "STUDENT") {
    if (conversation.student_id !== auth.sub) return false;
    const profile = await students.findByUserId(auth.sub);
    return Boolean(profile && profile.assigned_sales_id === conversation.sales_id);
  }
  if (auth.role === "SALES") {
    if (conversation.sales_id !== auth.sub) return false;
    const profile = await students.findByUserId(conversation.student_id);
    return Boolean(profile && profile.assigned_sales_id === auth.sub);
  }
  return false;
}

async function listConversations(auth) {
  return (await messages.listForViewer(auth)).map(mapConversation);
}

async function getConversation(auth, conversationId) {
  const conversation = await messages.findById(conversationId);
  if (!conversation) fail("Conversation introuvable.", 404);
  if (!canView(auth, conversation)) fail("Vous n’avez pas accès à cette discussion.", 403);
  await messages.markRead(conversationId, auth.sub);
  const student = await users.findById(conversation.student_id);
  const sales = await users.findById(conversation.sales_id);
  return {
    conversation: {
      id: conversation.id,
      studentId: conversation.student_id,
      salesId: conversation.sales_id,
      studentName: `${student.prenom} ${student.nom}`,
      salesName: `${sales.prenom} ${sales.nom}`,
      studentAvatarUrl: student.avatar_url || "",
      salesAvatarUrl: sales.avatar_url || "",
      canSend: await canSend(auth, conversation)
    },
    messages: (await messages.listMessages(conversationId)).map(mapMessage)
  };
}

async function openWithStudent(auth, studentId) {
  const student = await users.findById(studentId);
  if (!student || student.role !== "STUDENT") fail("Étudiant introuvable.", 404);
  const profile = await students.ensureProfile(studentId);

  let salesId = profile.assigned_sales_id;
  if (auth.role === "STUDENT") {
    if (auth.sub !== studentId) fail("Accès refusé.", 403);
    if (!salesId) fail("Aucun conseiller ne vous est encore affecté.", 409);
  } else if (auth.role === "SALES") {
    if (salesId !== auth.sub) fail("Cet étudiant n’est pas à votre charge.", 403);
    salesId = auth.sub;
  } else if (auth.role === "ADMIN") {
    if (!salesId) fail("Cet étudiant n’a pas encore de conseiller.", 409);
  } else {
    fail("Accès refusé.", 403);
  }

  const conversation = await messages.createPair(studentId, salesId);
  return getConversation(auth, conversation.id);
}

async function sendMessage(auth, conversationId, rawBody) {
  const conversation = await messages.findById(conversationId);
  if (!conversation) fail("Conversation introuvable.", 404);
  if (!(await canSend(auth, conversation))) fail("Vous ne pouvez pas écrire dans cette discussion.", 403);

  const body = String(rawBody || "").replace(/\s+/g, " ").trim();
  if (body.length < 1) fail("Le message ne peut pas être vide.");
  if (body.length > 2000) fail("Le message ne peut pas dépasser 2000 caractères.");

  const created = await messages.insertMessage(conversationId, auth.sub, body);
  await messages.markRead(conversationId, auth.sub);
  const sender = await users.findById(auth.sub);
  return mapMessage({
    ...created,
    sender_prenom: sender.prenom,
    sender_nom: sender.nom,
    sender_role: sender.role,
    sender_avatar_url: sender.avatar_url || ""
  });
}

async function unread(auth) {
  return { unread: await messages.unreadCount(auth.sub) };
}

module.exports = { listConversations, getConversation, openWithStudent, sendMessage, unread };
