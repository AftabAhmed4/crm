

"use client";
import { useRouter } from "next/navigation";
import React, {
  useState,
  useEffect,
   useMemo,
   useCallback,
  useRef,
} from "react";

import {
  Search,
  Filter,
  Star,
  MoreVertical,
  Paperclip,
  Image as ImageIcon,
  FileText,
  Smile,
  Send,
  Download,
  Calendar,
  CheckCheck,
  Menu,
  ChevronLeft,
  Plus,
  Users,
  X,
  UserPlus,
  Phone,
  Info,
  Loader2,
} from "lucide-react";
import LogoutModal from "@/components/LogoutModal";
import Sidebar from "@/components/Sidebar";
import CRMLoader from "@/components/CRMLoader";

export default function MessagesDashboard() {
  const router = useRouter();
  

  /* ==================================================
     CONVERSATIONS
  ================================================== */

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);

  const [activeTab, setActiveTab] = useState("All");
  const [selectedChat, setSelectedChat] = useState(null);

  /* ==================================================
     MESSAGE STATES
  ================================================== */

  const [inputMessage, setInputMessage] = useState("");
  const [loadingConversations, setLoadingConversations] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [sendingMessage, setSendingMessage] = useState(false);
  const [conversations, setConversations] = useState([]);
  const [users, setUsers] = useState([]);
  const [showMobileChat, setShowMobileChat] = useState(false);

  /* ==================================================
     GROUP CREATE STATES
  ================================================== */

  const [isGroupModalOpen, setIsGroupModalOpen] = useState(false);
  const [groupName, setGroupName] = useState("");
  const [selectedMembers, setSelectedMembers] = useState([]);
  const [customName, setCustomName] = useState("");
  const [customPhone, setCustomPhone] = useState("");
  const [customMembersList, setCustomMembersList] = useState([]);

  /* ==================================================
     GROUP INFO
  ================================================== */

  const [isGroupInfoOpen, setIsGroupInfoOpen] = useState(false);

  /* ==================================================
     ADD MEMBER
  ================================================== */

  const [isAddMemberModalOpen, setIsAddMemberModalOpen] = useState(false);
  const [newMemberName, setNewMemberName] = useState("");
  const [newMemberPhone, setNewMemberPhone] = useState("");

  /* ==================================================
     SEARCH
  ================================================== */

  const [searchText, setSearchText] = useState("");

  /* ==================================================
     REFS
  ================================================== */

  const fileInputRef = useRef(null);
  const messagesEndRef = useRef(null);
const unreadCount = conversations.reduce(
  (total, conversation) =>
    total + Number(conversation.unread_count || 0),
  0
);

  /* ==================================================
     CURRENT TIME
  ================================================== */

  const getCurrentTime = () => {
    return new Date().toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  /* ==================================================
     LOGOUT
  ================================================== */

  // const handleConfirmLogout = async () => {
  //   setLoggingOut(true);

  //   try {
  //     localStorage.removeItem("crm_login_time");

  //     const response = await fetch("/api/logout", {
  //       method: "POST",
  //       credentials: "include",
  //     });

  //     const data = await response.json();

  //     if (!response.ok || !data.success) {
  //       alert(data.message || "Logout failed");
  //       setLoggingOut(false);
  //       setShowLogoutModal(false);
  //       return;
  //     }

  //     router.push("/login");
  //   } catch (error) {
  //     console.error("Logout error:", error);
  //     alert("Something went wrong during logout.");
  //     setLoggingOut(false);
  //     setShowLogoutModal(false);
  //   }
  // };

  // // =========  loder start  ==========
  // if (loading) {
  //   return (
  //     <CRMLoader
  //       title="CRM"
  //  subtitle="message"
  //       message="Loading admin workspace..."
  //     />
  //   );
  // }
  // =========  loder end  ==========

  /* ==================================================
     MESSAGE DATE HELPERS
  ================================================== */

  const formatMessageDate = (dateValue) => {
    if (!dateValue) return "";

    const date = new Date(dateValue);

    if (Number.isNaN(date.getTime())) {
      return "";
    }

    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const isSameMessageDate = (date1, date2) => {
    if (!date1 || !date2) return false;

    const first = new Date(date1);
    const second = new Date(date2);

    return (
      first.getFullYear() === second.getFullYear() &&
      first.getMonth() === second.getMonth() &&
      first.getDate() === second.getDate()
    );
  };

  /* ==================================================
     LOAD CONVERSATIONS
  ================================================== */

  const loadConversations = async () => {
    try {
      const response = await fetch("/api/conversations", {
        method: "GET",
        credentials: "include",
        cache: "no-store",
      });
      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || "Failed to load conversations");
      }

      const loggedInUser = data.currentUser || currentUser;
      const currentUserId = Number(loggedInUser?.id);
      const existingConversations = Array.isArray(data.conversations)
        ? data.conversations
        : [];
      const allUsers = Array.isArray(data.users) ? data.users : [];

      if (loggedInUser && loggedInUser.id) {
        setCurrentUser(loggedInUser);
      }
      setUsers(allUsers);

    /* ==================================================
       GROUP CHATS
    ================================================== */

    const groupChatsMap = new Map();

    existingConversations
      .filter(
        (chat) =>
          String(chat.type).toLowerCase() === "group"
      )
      .forEach((chat) => {
        const conversationId = Number(chat.id);

        if (
          Number.isInteger(conversationId) &&
          conversationId > 0
        ) {
          groupChatsMap.set(conversationId, {
            ...chat,
            id: conversationId,
            conversationId: conversationId,
            type: "group",
          });
        }
      });

    const groupChats = Array.from(
      groupChatsMap.values()
    );

    /* ==================================================
       EXISTING DIRECT CHATS
    ================================================== */

    const existingDirectChats =
      existingConversations.filter(
        (chat) =>
          String(chat.type).toLowerCase() === "direct"
      );

    /* ==================================================
       DIRECT CHAT MAP
       
       IMPORTANT:
       userId => only ONE chat
    ================================================== */

    const directChatsMap = new Map();

    /* ==================================================
       FIRST:
       Add REAL DIRECT CONVERSATIONS
    ================================================== */

    existingDirectChats.forEach((chat) => {
      const memberUserId = chat.members?.find(
        (member) =>
          Number(member.user_id ?? member.id) !==
          currentUserId
      )?.user_id ?? chat.members?.find(
        (member) =>
          Number(member.user_id ?? member.id) !==
          currentUserId
      )?.id;

      const rawUserId =
        chat.user_id ??
        chat.userId ??
        chat.other_user_id ??
        chat.otherUserId ??
        memberUserId;

      const userId = Number(rawUserId);

      if (
        !Number.isInteger(userId) ||
        userId <= 0
      ) {
        return;
      }

      /* Never show current user */
      if (userId === currentUserId) {
        return;
      }

      /*
        Real conversation gets priority.
        If same user already exists, don't add again.
      */

      if (!directChatsMap.has(userId)) {
        const otherUser = chat.members?.find(
          (member) =>
            Number(member.user_id ?? member.id) ===
            userId
        );

        directChatsMap.set(userId, {
          ...chat,

          id:
            Number(chat.id) > 0
              ? Number(chat.id)
              : null,

          conversationId:
            Number(chat.id) > 0
              ? Number(chat.id)
              : `direct-${userId}`,

          user_id: userId,
          userId: userId,

          name:
            otherUser?.name ||
            otherUser?.email ||
            chat.name ||
            "Unknown User",

          email:
            otherUser?.email ||
            chat.email ||
            "",

          phone:
            otherUser?.phone ||
            chat.phone ||
            "",

          initials:
            otherUser?.initials ||
            chat.initials ||
            (otherUser?.name ||
              otherUser?.email ||
              chat.name ||
              "U")
              .slice(0, 2)
              .toUpperCase(),

          type: "direct",

          messages: Array.isArray(chat.messages)
            ? chat.messages
            : [],

          unread_count:
            Number(chat.unread_count) || 0,
        });
      }
    });

    /* ==================================================
       SECOND:
       ADD USERS WITHOUT A REAL CONVERSATION
       
       These become fake direct chats.
    ================================================== */

    allUsers.forEach((user) => {
      const userId = Number(user.id);

      /* Invalid user */
      if (
        !Number.isInteger(userId) ||
        userId <= 0
      ) {
        return;
      }

      /* Never show current logged-in user */
      if (userId === currentUserId) {
        return;
      }

      /*
        VERY IMPORTANT:
        If this user already has a real direct chat,
        DO NOT CREATE ANOTHER CHAT.
      */

      if (directChatsMap.has(userId)) {
        return;
      }

      const userName =
        user.name?.trim() || "Unknown";

      const initials =
        userName
          .slice(0, 2)
          .toUpperCase() || "U";

      directChatsMap.set(userId, {
        id: null,

        conversationId: `direct-${userId}`,

        user_id: userId,
        userId: userId,

        name: userName,

        email: user.email || "",

        phone: user.phone || "",

        role: user.role || "",

        type: "direct",

        initials,

        avatar_bg:
          "bg-emerald-100 text-emerald-600",

        avatarBg:
          "bg-emerald-100 text-emerald-600",

        lastMsg: "No messages yet",

        last_msg: "No messages yet",

        last_msg_time: null,

        unread_count: 0,

        messages: [],
      });
    });

    /* ==================================================
       FINAL DIRECT CHATS
    ================================================== */

    const directChats = Array.from(
      directChatsMap.values()
    );

    /* ==================================================
       FINAL CHATS
    ================================================== */

    const chats = [
      ...directChats,
      ...groupChats,
    ];

    console.log("=================================");
    console.log(
      "REAL DIRECT CHATS:",
      existingDirectChats
    );
    console.log(
      "UNIQUE DIRECT CHATS:",
      directChats
    );
    console.log(
      "GROUP CHATS:",
      groupChats
    );
    console.log(
      "FINAL CHATS:",
      chats
    );
    console.log(
      "FINAL CHAT COUNT:",
      chats.length
    );
    console.log("=================================");

    /* ==================================================
       SAVE CONVERSATIONS
    ================================================== */

    setConversations(chats);

    /* ==================================================
       KEEP SELECTED CHAT
    ================================================== */

    setSelectedChat((current) => {
      /* No chats */
      if (!chats.length) {
        return null;
      }

      /* Nothing selected */
      if (!current) {
        return chats[0];
      }

      const currentConversationId =
        Number(current.id);

      const currentUserIdFromChat =
        Number(
          current.user_id ??
          current.userId
        );

      /* ==================================================
         FIND UPDATED CHAT
      ================================================== */

      const updatedChat = chats.find((chat) => {
        const chatConversationId =
          Number(chat.id);

        const chatUserId =
          Number(
            chat.user_id ??
            chat.userId
          );

        /* -----------------------------------------------
           MATCH REAL CONVERSATION ID
        ------------------------------------------------ */

        if (
          Number.isInteger(
            currentConversationId
          ) &&
          currentConversationId > 0 &&
          Number.isInteger(
            chatConversationId
          ) &&
          chatConversationId > 0 &&
          chatConversationId ===
            currentConversationId
        ) {
          return true;
        }

        /* -----------------------------------------------
           MATCH USER ID
        ------------------------------------------------ */

        if (
          Number.isInteger(
            currentUserIdFromChat
          ) &&
          currentUserIdFromChat > 0 &&
          Number.isInteger(chatUserId) &&
          chatUserId > 0 &&
          chatUserId ===
            currentUserIdFromChat
        ) {
          return true;
        }

        /* -----------------------------------------------
           MATCH fake direct-userId
        ------------------------------------------------ */

        if (
          typeof current.conversationId ===
            "string" &&
          current.conversationId.startsWith(
            "direct-"
          ) &&
          typeof chat.conversationId ===
            "string" &&
          chat.conversationId ===
            current.conversationId
        ) {
          return true;
        }

        return false;
      });

      /* ==================================================
         RETURN UPDATED CHAT
      ================================================== */

      if (updatedChat) {
        return {
          ...updatedChat,

          /*
            Keep already loaded messages
            if they exist.
          */
          messages:
            Array.isArray(current.messages) &&
            current.messages.length > 0
              ? current.messages
              : Array.isArray(
                  updatedChat.messages
                )
              ? updatedChat.messages
              : [],
        };
      }

      /* ==================================================
         CURRENT CHAT NO LONGER EXISTS
         SELECT FIRST CHAT
      ================================================== */

      return chats[0];
    });
  } catch (error) {
    console.error(
      "Load Conversations Error:",
      error
    );
  } finally {
    setLoadingConversations(false);
  }
};

  /* ==================================================
     LOAD MESSAGES
  ================================================== */

  const loadMessages = async (chat) => {
    try {
      if (!chat) {
        return;
      }

      const conversationId = Number(chat.id);

      if (
        !Number.isInteger(conversationId) ||
        conversationId <= 0
      ) {
        setSelectedChat((current) =>
          current
            ? {
                ...current,
                messages: [],
              }
            : current
        );

        return;
      }

      const response = await fetch(
        `/api/messages?conversationId=${conversationId}`,
        {
          method: "GET",
          credentials: "include",
          cache: "no-store",
        }
      );

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(
          data.message || "Failed to load messages"
        );
      }

      const messages = (data.messages || []).map((message) => ({
        id: message.id,
        conversation_id: message.conversation_id,

        sender:
          Number(message.sender_id) === Number(currentUser?.id)
            ? "me"
            : "them",

        senderId: Number(message.sender_id),

        senderName: message.sender_name || "",
        senderEmail: message.sender_email || "",

        text: message.text || "",

        time: message.created_at
          ? new Date(message.created_at).toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            })
          : "",

        type: message.msg_type || "text",

        fileName: message.file_name || null,
        fileSize: message.file_size || null,
        fileUrl: message.file_url || null,

        created_at: message.created_at || null,
      }));

      setSelectedChat((current) =>
        current
          ? {
              ...current,
              messages,
            }
          : current
      );
    } catch (error) {
      console.error("Load Messages Error:", error);
    }
  };

  /* ==================================================
     INITIAL LOAD
  ================================================== */

// INITIAL LOAD
useEffect(() => {
  loadConversations();
}, []);

// AUTO REFRESH CHAT LIST AND ACTIVE CHAT
useEffect(() => {
  const refreshMessages = async () => {
    try {
      await loadConversations();
    } catch (error) {
      console.error(
        "Auto refresh messages error:",
        error
      );
    }
  };

  const interval = setInterval(
    refreshMessages,
    5000
  );

  return () => {
    clearInterval(interval);
  };
}, [currentUser?.id]);
// LOADER
// if (loadingConversations) {
//   return (
//     <CRMLoader
//       subtitle="Conversations"
//       message="Loading your conversations..."
//     />
//   );
// }


  

  /* ==================================================
     CHAT CHANGE
  ================================================== */

  useEffect(() => {
    if (selectedChat) {
      loadMessages(selectedChat);
    }
  }, [selectedChat?.id]);

  /* ==================================================
     AUTO SCROLL
  ================================================== */

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({
      behavior: "smooth",
    });
  }, [selectedChat?.messages, loadingMessages]);

  /* ==================================================
     SELECT CHAT
  ================================================== */

const handleSelectChat = async (chat) => {
  if (!chat) return;

  console.log("=================================");
  console.log("SELECT CHAT");
  console.log("=================================");
  console.log("Selected Chat:", chat);
  console.log("Chat ID:", chat.id);
  console.log("Conversation ID:", chat.conversationId);
  console.log("User ID:", chat.user_id || chat.userId);

  setSelectedChat(chat);
  setShowMobileChat(true);

  /*
  ==================================================
  CLEAR UNREAD LOCALLY IMMEDIATELY
  ==================================================
  */

  setConversations((prev) =>
    prev.map((item) => {
      const sameConversation =
        Number(item.id) > 0 &&
        Number(chat.id) > 0 &&
        Number(item.id) === Number(chat.id);

      const sameUser =
        Number(item.user_id || item.userId) > 0 &&
        Number(chat.user_id || chat.userId) > 0 &&
        Number(item.user_id || item.userId) ===
          Number(chat.user_id || chat.userId);

      if (sameConversation || sameUser) {
        return {
          ...item,
          unread_count: 0,
        };
      }

      return item;
    })
  );

  /*
  ==================================================
  MARK MESSAGES AS READ
  ==================================================
  */

  const conversationId = Number(
    chat.conversationId ??
    chat.conversation_id ??
    chat.id
  );

  if (
    Number.isInteger(conversationId) &&
    conversationId > 0
  ) {
    try {
      console.log(
        "MARKING READ:",
        conversationId
      );

      const response = await fetch(
        "/api/message/read",
        {
          method: "POST",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
          },
          cache: "no-store",
          body: JSON.stringify({
            conversationId,
          }),
        }
      );

      const data = await response.json();

      console.log(
        "================================="
      );
      console.log(
        "MARK READ RESPONSE"
      );
      console.log(
        "================================="
      );
      console.log(
        "Status:",
        response.status
      );
      console.log(
        "Response:",
        data
      );

      if (!response.ok || !data?.success) {
        console.error(
          "Mark read failed:",
          data?.message
        );
      } else {
        /*
        ==========================================
        FORCE LOCAL UNREAD = 0
        ==========================================
        */

        setConversations((prev) =>
          prev.map((item) => {
            const sameConversation =
              Number(item.id) ===
              conversationId;

            if (sameConversation) {
              return {
                ...item,
                unread_count: 0,
              };
            }

            return item;
          })
        );
      }
    } catch (error) {
      console.error(
        "Mark Messages Read Error:",
        error
      );
    }
  }

  /*
  ==================================================
  LOAD MESSAGES
  ==================================================
  */

  await loadMessages(chat);
};

  /* ==================================================
     SEND TEXT MESSAGE
  ================================================== */

 const handleSendMessage = async (e) => {
  e?.preventDefault();

  const text = inputMessage.trim();

  if (!text || sendingMessage) {
    return;
  }

  const currentUserId = Number(currentUser?.id);

  /* ==================================================
     GET CONVERSATION ID
  ================================================== */

  const rawConversationId =
    selectedChat?.conversationId ??
    selectedChat?.conversation_id ??
    selectedChat?.id ??
    null;

  /* ==================================================
     GET TARGET USER ID
     Supports all common field names
  ================================================== */

  const rawTargetUserId =
    selectedChat?.targetUserId ??
    selectedChat?.target_user_id ??
    selectedChat?.user_id ??
    selectedChat?.userId ??
    selectedChat?.otherUserId ??
    selectedChat?.other_user_id ??
    null;

  let conversationId = null;
  let targetUserId = null;

  /* ==================================================
     NORMALIZE CONVERSATION ID
  ================================================== */

  if (
    rawConversationId !== null &&
    rawConversationId !== undefined &&
    rawConversationId !== ""
  ) {
    const numericConversationId = Number(rawConversationId);

    if (
      Number.isInteger(numericConversationId) &&
      numericConversationId > 0
    ) {
      conversationId = numericConversationId;
    }
  }

  /* ==================================================
     HANDLE TEMPORARY DIRECT CHAT IDs

     Example:
     direct-5
     direct-2
  ================================================== */

  if (
    typeof rawConversationId === "string" &&
    rawConversationId.startsWith("direct-")
  ) {
    conversationId = null;
  }

  /* ==================================================
     NORMALIZE TARGET USER ID
  ================================================== */

  if (
    rawTargetUserId !== null &&
    rawTargetUserId !== undefined &&
    rawTargetUserId !== ""
  ) {
    const numericTargetUserId = Number(rawTargetUserId);

    if (
      Number.isInteger(numericTargetUserId) &&
      numericTargetUserId > 0
    ) {
      targetUserId = numericTargetUserId;
    }
  }

  /* ==================================================
     DEBUG
  ================================================== */

  console.log("=================================");
  console.log("SEND MESSAGE DEBUG");
  console.log("=================================");

  console.log("Current User ID:", currentUserId);
  console.log("Selected Chat:", selectedChat);
  console.log("Raw Conversation ID:", rawConversationId);
  console.log("Raw Target User ID:", rawTargetUserId);
  console.log("Final Conversation ID:", conversationId);
  console.log("Final Target User ID:", targetUserId);

  /* ==================================================
     VALIDATION
  ================================================== */

  if (!conversationId && !targetUserId) {
    alert("No conversation or target user selected");
    return;
  }

  if (
    targetUserId &&
    targetUserId === currentUserId
  ) {
    alert("You cannot send a message to yourself");
    return;
  }

  try {
    setSendingMessage(true);

    /* ==================================================
       BUILD REQUEST BODY
    ================================================== */

    const body = {
      text,
      msgType: "text",
    };

    /*
     IMPORTANT:
     Send BOTH IDs when available.

     targetUserId tells the API exactly who the
     message is intended for.

     conversationId is still sent when we have it.
    */

    if (conversationId) {
      body.conversationId = conversationId;
    }

    if (targetUserId) {
      body.targetUserId = targetUserId;
    }

    console.log("=================================");
    console.log("POST /api/messages BODY");
    console.log("=================================");
    console.log(body);

    /* ==================================================
       SEND MESSAGE
    ================================================== */

    const response = await fetch("/api/messages", {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    let data = null;

    try {
      data = await response.json();
    } catch (jsonError) {
      console.error(
        "Invalid JSON response:",
        jsonError
      );

      throw new Error(
        `Server returned invalid response (${response.status})`
      );
    }

    console.log("=================================");
    console.log("POST /api/messages RESPONSE");
    console.log("=================================");
    console.log(data);

    /* ==================================================
       API ERROR
    ================================================== */

    if (!response.ok || !data?.success) {
      throw new Error(
        data?.message ||
          `Failed to send message (${response.status})`
      );
    }

    /* ==================================================
       GET REAL CONVERSATION ID
    ================================================== */

    const realConversationId = Number(
      data.conversationId
    );

    const apiMessage = data.data;

    if (
      !Number.isInteger(realConversationId) ||
      realConversationId <= 0
    ) {
      throw new Error(
        "API did not return a valid conversation ID"
      );
    }

    if (!apiMessage) {
      throw new Error(
        "API did not return the sent message"
      );
    }

    /* ==================================================
       CREATE FRONTEND MESSAGE OBJECT
    ================================================== */

    const senderId = Number(
      apiMessage.sender_id
    );

    const messageCreatedAt =
      apiMessage.created_at || null;

    const messageTime = messageCreatedAt
      ? new Date(
          messageCreatedAt
        ).toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        })
      : getCurrentTime();

    const newMessage = {
      id: Number(apiMessage.id),

      conversation_id: realConversationId,

      sender:
        senderId === currentUserId
          ? "me"
          : "them",

      senderId,

      senderName:
        apiMessage.sender_name ||
        currentUser?.name ||
        "You",

      senderEmail:
        apiMessage.sender_email ||
        currentUser?.email ||
        "",

      text:
        apiMessage.text ||
        text,

      time: messageTime,

      type:
        apiMessage.msg_type ||
        "text",

      fileName:
        apiMessage.file_name ||
        null,

      fileSize:
        apiMessage.file_size ||
        null,

      fileUrl:
        apiMessage.file_url ||
        null,

      created_at:
        messageCreatedAt,
    };

    /* ==================================================
       UPDATE SELECTED CHAT
    ================================================== */

    setSelectedChat((current) => {
      if (!current) {
        return current;
      }

      return {
        ...current,

        /*
         * Replace temporary/stale ID with real DB ID
         */
        id: realConversationId,

        conversationId:
          realConversationId,

        conversation_id:
          realConversationId,

        /*
         * Preserve target user
         */
        user_id:
          targetUserId ||
          current.user_id ||
          null,

        userId:
          targetUserId ||
          current.userId ||
          null,

        targetUserId:
          targetUserId ||
          current.targetUserId ||
          null,

        messages: [
          ...(current.messages || []),
          newMessage,
        ],

        lastMsg:
          newMessage.text,

        last_msg:
          newMessage.text,

        last_msg_time:
          messageCreatedAt,

        time:
          messageTime,
      };
    });

    /* ==================================================
       UPDATE SIDEBAR
    ================================================== */

    setConversations((prev) => {
      const realId =
        Number(realConversationId);

      const existingChatIndex =
        prev.findIndex(
          (chat) =>
            Number(
              chat.id ??
              chat.conversationId ??
              chat.conversation_id
            ) === realId
        );

      /*
       * Existing conversation
       */

      if (existingChatIndex !== -1) {
        return prev.map((chat, index) => {
          if (index !== existingChatIndex) {
            return chat;
          }

          const selectedConversationId =
            Number(
              selectedChat?.id ??
              selectedChat?.conversationId ??
              selectedChat?.conversation_id ??
              0
            );

          const isSelected =
            selectedConversationId === realId;

          return {
            ...chat,

            id: realId,

            conversationId:
              realId,

            conversation_id:
              realId,

            lastMsg:
              newMessage.text || "",

            last_msg:
              newMessage.text || "",

            last_msg_time:
              messageCreatedAt,

            time:
              messageTime,

            unread_count:
              isSelected
                ? Number(
                    chat.unread_count || 0
                  )
                : Number(
                    chat.unread_count || 0
                  ) + 1,
          };
        });
      }

      /*
       * If this is a newly created conversation,
       * add it to the sidebar.
       */

      return [
        {
          id: realId,

          conversationId:
            realId,

          conversation_id:
            realId,

          user_id:
            targetUserId || null,

          userId:
            targetUserId || null,

          targetUserId:
            targetUserId || null,

          name:
            selectedChat?.name ||
            selectedChat?.user_name ||
            selectedChat?.username ||
            "User",

          email:
            selectedChat?.email ||
            selectedChat?.user_email ||
            "",

          lastMsg:
            newMessage.text || "",

          last_msg:
            newMessage.text || "",

          last_msg_time:
            messageCreatedAt,

          time:
            messageTime,

          unread_count: 0,

          messages: [newMessage],
        },

        ...prev,
      ];
    });

    /* ==================================================
       CLEAR INPUT
    ================================================== */

    setInputMessage("");

    console.log(
      "Message sent successfully:",
      {
        conversationId:
          realConversationId,
        targetUserId,
        messageId:
          newMessage.id,
      }
    );
  } catch (error) {
    console.error(
      "================================="
    );

    console.error(
      "SEND MESSAGE ERROR:",
      error
    );

    console.error(
      "================================="
    );

    alert(
      error?.message ||
        "Message send failed"
    );
  } finally {
    setSendingMessage(false);
  }
};

  /* ==================================================
     FILE UPLOAD
  ================================================== */

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];

    if (
      !file ||
      !selectedChat ||
      sendingMessage
    ) {
      return;
    }

    const conversationId = Number(
      selectedChat.id
    );

    if (
      !Number.isInteger(conversationId) ||
      conversationId <= 0
    ) {
      alert(
        "Please send a message first to create the conversation."
      );

      e.target.value = "";
      return;
    }

    try {
      setSendingMessage(true);

      const formData = new FormData();

      formData.append(
        "conversationId",
        String(conversationId)
      );

      formData.append("file", file);
      formData.append("text", "");

      const response = await fetch(
        "/api/messages",
        {
          method: "POST",
          credentials: "include",
          body: formData,
        }
      );

      const data = await response.json();

      if (
        !response.ok ||
        !data.success
      ) {
        throw new Error(
          data.message ||
            "File upload failed"
        );
      }

      const apiMessage = data.data;

      const messageType =
        apiMessage.msg_type ||
        (file.type.startsWith("image/")
          ? "image"
          : "file");

      const newMessage = {
        id: Number(apiMessage.id),

        conversation_id: conversationId,

        sender:
          Number(apiMessage.sender_id) ===
          Number(currentUser?.id)
            ? "me"
            : "them",

        senderId: Number(apiMessage.sender_id),

        senderName:
          apiMessage.sender_name ||
          currentUser?.name ||
          "You",

        senderEmail:
          apiMessage.sender_email ||
          currentUser?.email ||
          "",

        text: apiMessage.text || "",

        time: apiMessage.created_at
          ? new Date(
              apiMessage.created_at
            ).toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            })
          : getCurrentTime(),

        type: messageType,

        fileName:
          apiMessage.file_name ||
          file.name,

        fileSize:
          apiMessage.file_size ||
          `${(file.size / 1024).toFixed(1)} KB`,

        fileUrl:
          apiMessage.file_url ||
          null,

        created_at:
          apiMessage.created_at ||
          null,
      };

      const previewText =
        messageType === "image"
          ? "📷 Image"
          : `📎 ${newMessage.fileName}`;

      setSelectedChat((current) =>
        current
          ? {
              ...current,

              messages: [
                ...(current.messages || []),
                newMessage,
              ],

              last_msg: previewText,
              lastMsg: previewText,

              last_msg_time:
                apiMessage.created_at ||
                null,

              time: newMessage.time,
            }
          : current
      );

      setConversations((prev) =>
        prev.map((chat) =>
          Number(chat.id) ===
          conversationId
            ? {
                ...chat,

                messages: [
                  ...(chat.messages || []),
                  newMessage,
                ],

                last_msg: previewText,
                lastMsg: previewText,

                last_msg_time:
                  apiMessage.created_at ||
                  null,

                time: newMessage.time,
              }
            : chat
        )
      );

      e.target.value = "";
    } catch (error) {
      console.error(
        "File Upload Error:",
        error
      );

      alert(
        error.message ||
          "File upload failed"
      );
    } finally {
      setSendingMessage(false);
    }
  };

  /* ==================================================
     ADD MEMBER TO EXISTING GROUP
  ================================================== */

  const handleAddMemberToExistingGroup = async (e) => {
    e.preventDefault();

    if (
      !newMemberName.trim() ||
      !newMemberPhone.trim() ||
      !selectedChat
    ) {
      return;
    }

    const conversationId = Number(
      selectedChat.id
    );

    if (
      !Number.isInteger(conversationId) ||
      conversationId <= 0
    ) {
      alert("Invalid group conversation.");
      return;
    }

    try {
      setSendingMessage(true);

      const response = await fetch(
        "/api/conversations/members",
        {
          method: "POST",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            conversationId,
            name: newMemberName.trim(),
            phone: newMemberPhone.trim(),
          }),
        }
      );

      const data = await response.json();

      if (
        !response.ok ||
        !data.success
      ) {
        throw new Error(
          data.message ||
            "Failed to add member"
        );
      }

      const newMember = data.member;

      const updatedChat = {
        ...selectedChat,

        members: [
          ...(selectedChat.members || []),
          newMember,
        ],
      };

      setSelectedChat(updatedChat);

      setConversations((prev) =>
        prev.map((chat) =>
          Number(chat.id) === conversationId
            ? updatedChat
            : chat
        )
      );

      setNewMemberName("");
      setNewMemberPhone("");
      setIsAddMemberModalOpen(false);

      await loadConversations();
    } catch (error) {
      console.error(
        "Add Member Error:",
        error
      );

      alert(
        error.message ||
          "Failed to add member"
      );
    } finally {
      setSendingMessage(false);
    }
  };

  /* ==================================================
     CUSTOM MEMBER
  ================================================== */

  const handleAddCustomMember = () => {
    if (
      !customName.trim() ||
      !customPhone.trim()
    ) {
      return;
    }

    const newMember = {
      id: `custom-${Date.now()}`,

      name: customName.trim(),

      phone: customPhone.trim(),

      role: "member",

      avatarBg:
        "bg-blue-100 text-blue-600",

      initials:
        customName
          .trim()
          .slice(0, 2)
          .toUpperCase(),

      isCustom: true,
    };

    setCustomMembersList((prev) => [
      ...prev,
      newMember,
    ]);

    setCustomName("");
    setCustomPhone("");
  };

  /* ==================================================
     REMOVE CUSTOM MEMBER
  ================================================== */

  const removeCustomMember = (memberId) => {
    setCustomMembersList((prev) =>
      prev.filter(
        (member) =>
          member.id !== memberId
      )
    );
  };

  /* ==================================================
     TOGGLE EXISTING MEMBER
  ================================================== */

  const handleMemberToggle = (contact) => {
    const contactId =
      contact?.user_id ??
      contact?.id;

    if (!contactId) {
      return;
    }

    const exists = selectedMembers.some(
      (member) =>
        Number(
          member.user_id ??
          member.id
        ) === Number(contactId)
    );

    if (exists) {
      setSelectedMembers((prev) =>
        prev.filter(
          (member) =>
            Number(
              member.user_id ??
              member.id
            ) !== Number(contactId)
        )
      );
    } else {
      setSelectedMembers((prev) => [
        ...prev,
        contact,
      ]);
    }
  };

  /* ==================================================
     CREATE GROUP
  ================================================== */

  const handleCreateGroup = async (e) => {
    e.preventDefault();

    if (!groupName.trim()) {
      alert("Group name is required");
      return;
    }

    const existingMemberIds = [
      ...new Set(
        selectedMembers
          .map((member) => {
            const rawId =
              member?.user_id ??
              member?.id;

            const numericId =
              Number(rawId);

            if (
              Number.isInteger(numericId) &&
              numericId > 0
            ) {
              return numericId;
            }

            return null;
          })
          .filter(
            (id) => id !== null
          )
      ),
    ];

    console.log(
      "SELECTED MEMBERS:",
      selectedMembers
    );

    console.log(
      "GROUP MEMBER IDS:",
      existingMemberIds
    );

    if (
      existingMemberIds.length === 0
    ) {
      alert(
        "Please select at least one existing user."
      );
      return;
    }

    try {
      setSendingMessage(true);

      const response = await fetch(
        "/api/conversations",
        {
          method: "POST",
          credentials: "include",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify({
            type: "group",
            name: groupName.trim(),
            members:
              existingMemberIds,
          }),
        }
      );

      const data = await response.json();

      console.log(
        "CREATE GROUP RESPONSE:",
        data
      );

      if (
        !response.ok ||
        !data.success
      ) {
        if (
          data.invalidUsers?.length
        ) {
          throw new Error(
            `Invalid user IDs: ${data.invalidUsers.join(
              ", "
            )}`
          );
        }

        throw new Error(
          data.message ||
            "Group creation failed"
        );
      }

      const createdGroupId =
        Number(
          data.conversationId
        );

      if (
        !Number.isInteger(
          createdGroupId
        ) ||
        createdGroupId <= 0
      ) {
        throw new Error(
          "Invalid conversation ID returned by server"
        );
      }

      /* ==================================================
         CREATE TEMP GROUP OBJECT
      ================================================== */

      const createdGroup = {
        id: createdGroupId,

        conversationId:
          createdGroupId,

        type: "group",

        name:
          groupName.trim(),

        initials:
          groupName
            .trim()
            .slice(0, 2)
            .toUpperCase(),

        avatarBg:
          "bg-rose-100 text-rose-600",

        avatar_bg:
          "bg-rose-100 text-rose-600",

        members:
          data.conversation
            ?.members || [],

        messages: [],

        unread_count: 0,

        lastMsg:
          "No messages yet",

        last_msg:
          "No messages yet",

        last_msg_time: null,
      };

      /* ==================================================
         ADD GROUP TO SIDEBAR IMMEDIATELY
      ================================================== */

      setConversations((prev) => [
        ...prev.filter(
          (chat) =>
            Number(chat.id) !==
            createdGroupId
        ),
        createdGroup,
      ]);

      setSelectedChat(
        createdGroup
      );

      setShowMobileChat(true);

      /* ==================================================
         LOAD MESSAGES
      ================================================== */

      await loadMessages(
        createdGroup
      );

      /* ==================================================
         REFRESH CONVERSATIONS
      ================================================== */

      await loadConversations();

      /* ==================================================
         RESET MODAL
      ================================================== */

      setGroupName("");
      setSelectedMembers([]);
      setCustomMembersList([]);
      setCustomName("");
      setCustomPhone("");
      setIsGroupModalOpen(false);
    } catch (error) {
      console.error(
        "Create Group Error:",
        error
      );

      alert(
        error.message ||
          "Group creation failed"
      );
    } finally {
      setSendingMessage(false);
    }
  };





  const uniqueConversations = useMemo(() => {
  const seen = new Set();

  return conversations.filter((chat) => {
    // Group ke liye group ID use karo
    const key =
      chat.type === "group"
        ? `group-${chat.id}`
        : `user-${chat.user_id || chat.id}`;

    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}, [conversations]);

const filteredConversations = useMemo(() => {
  const term = searchText.trim().toLowerCase();

  return uniqueConversations.filter((chat) => {
    // Group tab
    if (activeTab === "Group" && chat.type !== "group") {
      return false;
    }

    // Search
    if (!term) {
      return true;
    }

    return (
      chat.name?.toLowerCase().includes(term) ||
      chat.email?.toLowerCase().includes(term) ||
      chat.phone?.toLowerCase().includes(term) ||
      chat.lastMsg?.toLowerCase().includes(term) ||
      chat.last_msg?.toLowerCase().includes(term)
    );
  });
}, [
  uniqueConversations,
  searchText,
  activeTab,
]);
  /* ==================================================
     FILTER CONVERSATIONS
  ================================================== */


  console.log(
    "FILTERED CONVERSATIONS:",
    filteredConversations
  );

  console.log(
    "FILTERED LENGTH:",
    filteredConversations.length
  );
 const handleConfirmLogout = async () => {
    setLoggingOut(true);

    try {
      localStorage.removeItem("crm_login_time");

      const response = await fetch("/api/logout", {
        method: "POST",
      });

      const data = await response.json();

      if (!response.ok) {
        alert(data?.message || "Logout failed");

        setLoggingOut(false);
        setShowLogoutModal(false);

        return;
      }

      router.push("/login");
    } catch (error) {
      console.error("Logout error:", error);

      alert(
        "Something went wrong during logout."
      );

      setLoggingOut(false);
      setShowLogoutModal(false);
    }
  };
   const [loading, setLoading] = useState(true);
      useEffect(() => {
    const timer = setTimeout(() => {
      setLoading(false);
    }, 4000);

    return () => clearTimeout(timer);
  }, []);

  // if (loading) {
  //   return < CRMLoader
  //    subtitle="messages"
  //       message="Loading dashboard..."
  //       />;
  // }


return (
  <div className="flex flex-col lg:ml-64 h-screen min-h-0 p-4 sm:p-6 lg:p-8 bg-slate-50 text-slate-800 font-sans overflow-hidden">

    {/* ==================================================
        MOBILE HEADER
    ================================================== */}

    <header className="lg:hidden h-16 bg-[#050B1E] border-b border-slate-800 flex items-center justify-between px-4 text-white shrink-0">

      <div className="flex items-center gap-2.5">

        <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-rose-500 to-indigo-600 p-[2px] flex items-center justify-center">

          <div className="w-full h-full bg-[#050B1E] rounded-full flex items-center justify-center">

            <div className="w-3.5 h-3.5 rounded-full border-2 border-rose-500 flex items-center justify-center">

              <div className="w-1 h-1 bg-white rounded-full" />

            </div>

          </div>

        </div>

        <span className="font-extrabold text-xl tracking-tight text-white">
          CallCRM
        </span>

      </div>

      <button
        type="button"
        onClick={() =>
          setSidebarOpen(!sidebarOpen)
        }
        className="p-2 rounded-lg text-slate-300 hover:bg-white/10"
      >
        {sidebarOpen ? (
          <X size={22} />
        ) : (
          <Menu size={22} />
        )}
      </button>

    </header>


    {/* ==================================================
        MOBILE OVERLAY
    ================================================== */}

    {sidebarOpen && (
      <div
        onClick={() =>
          setSidebarOpen(false)
        }
        className="fixed inset-0 z-40 bg-black/60 lg:hidden"
      />
    )}


    {/* ==================================================
        FILE INPUT
    ================================================== */}

    <input
      type="file"
      ref={fileInputRef}
      onChange={handleFileUpload}
      className="hidden"
    />


    {/* ==================================================
        TOP NAVBAR
    ================================================== */}

    <header className="h-14 bg-white border-b border-slate-200 px-4 sm:px-6 flex items-center justify-between shrink-0 rounded-t-xl">

      <div className="flex items-center gap-2 sm:gap-3">

        <h1 className="font-semibold text-base sm:text-lg text-slate-800">
          Messages Dashboard
        </h1>

      </div>


      <div className="flex items-center gap-2 sm:gap-4">

        <div className="hidden lg:flex bg-emerald-50 text-emerald-600 text-xs px-3 py-1.5 rounded-md font-medium items-center gap-1.5 border border-emerald-100">

          <Calendar className="w-3.5 h-3.5" />

          CRM Inbox

        </div>


        {/* <div className="flex items-center gap-2">

          <div className="w-8 h-8 rounded-full bg-emerald-600 text-white font-medium flex items-center justify-center text-xs">
            M
          </div>

          <div className="text-left text-xs hidden sm:block">

            <p className="font-semibold text-slate-700">
              M Aftab
            </p>

            <p className="text-slate-400 text-[10px]">
              admin@callcrm.com
            </p>

          </div>

        </div> */}

      </div>

    </header>


    {/* ==================================================
        MAIN CHAT AREA
    ================================================== */}

    <div className="flex-1 min-h-0 flex overflow-hidden relative border-x border-b border-slate-200 rounded-b-xl">


      {/* ==================================================
          LEFT SIDEBAR
      ================================================== */}

      <aside
        className={`w-full md:w-80 lg:w-96 bg-white border-r border-slate-200 flex flex-col shrink-0 min-h-0 ${
          showMobileChat
            ? "hidden md:flex"
            : "flex"
        }`}
      >


        {/* ==================================================
            SEARCH
        ================================================== */}

        <div className="p-3 flex items-center gap-2 shrink-0">

          <div className="relative flex-1">

            <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />

            <input
              type="text"
              placeholder="Search conversations..."
              value={searchText}
              onChange={(e) =>
                setSearchText(e.target.value)
              }
              className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:outline-none focus:border-emerald-500"
            />

          </div>


          <button
            type="button"
            className="p-1.5 text-slate-400 border border-slate-200 rounded-lg"
          >
            <Filter className="w-4 h-4" />
          </button>

        </div>


        {/* ==================================================
            TABS
        ================================================== */}

        {/* <div className="flex items-center justify-between border-b border-slate-200 px-3 shrink-0">

          <div className="flex">

            {["All", "Group"].map((tab) => (

              <button
                key={tab}
                type="button"
                onClick={() =>
                  setActiveTab(tab)
                }
                className={`py-2 px-3 text-xs font-medium border-b-2 ${
                  activeTab === tab
                    ? "border-emerald-500 text-emerald-600"
                    : "border-transparent text-slate-500 hover:text-slate-700"
                }`}
              >
                {tab}
              </button>

            ))}

          </div>


          {activeTab === "Group" && (

            <button
              type="button"
              onClick={() => {
                setGroupName("");
                setCustomName("");
                setCustomPhone("");
                setCustomMembersList([]);
                setSelectedMembers([]);
                setIsGroupModalOpen(true);
              }}
              className="mb-1 bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] px-2.5 py-1 rounded-md flex items-center gap-1 font-medium"
            >

              <Plus className="w-3.5 h-3.5" />

              Create Group

            </button>

          )}

        </div> */}

        <div className="flex items-center justify-between border-b border-slate-200 px-3 shrink-0">
  <div className="flex">

    {["All", "Group"].map((tab) => (
      <button
        key={tab}
        type="button"
        onClick={() => setActiveTab(tab)}
        className={`py-2 px-3 text-xs font-medium border-b-2 ${
          activeTab === tab
            ? "border-emerald-500 text-emerald-600"
            : "border-transparent text-slate-500 hover:text-slate-700"
        }`}
      >
        <span className="flex items-center gap-1.5">
          {tab}

          {tab === "All" && unreadCount > 0 && (
            <span className="min-w-[16px] h-4 px-1 rounded-full bg-emerald-500 text-white text-[10px] flex items-center justify-center">
              {unreadCount}
            </span>
          )}
        </span>
      </button>
    ))}

  </div>

  {activeTab === "Group" && (
    <button
      type="button"
      onClick={() => {
        setGroupName("");
        setCustomName("");
        setCustomPhone("");
        setCustomMembersList([]);
        setSelectedMembers([]);
        setIsGroupModalOpen(true);
      }}
      className="mb-1 bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] px-2.5 py-1 rounded-md flex items-center gap-1 font-medium"
    >
      <Plus className="w-3.5 h-3.5" />
      Create Group
    </button>
  )}
</div>


        {/* ==================================================
            CONVERSATIONS
        ================================================== */}

        <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden divide-y divide-slate-100">

          {loadingConversations ? (

            <div className="p-6 text-center text-xs text-slate-400 flex items-center justify-center gap-2">

              <Loader2 className="w-4 h-4 animate-spin" />

              Loading conversations...

            </div>

          ) : filteredConversations.length === 0 ? (

            <div className="p-6 text-center text-xs text-slate-400">

              No conversations found.

            </div>

          ) : (

            filteredConversations.map((chat) => {

              const lastMessage =
                chat.lastMsg ||
                chat.last_msg ||
                chat.last_message ||
                "";

              const lastTime =
                chat.time ||
                (
                  chat.last_msg_time
                    ? new Date(
                        chat.last_msg_time
                      ).toLocaleTimeString(
                        [],
                        {
                          hour: "2-digit",
                          minute: "2-digit",
                        }
                      )
                    : ""
                );

              const unreadCount = Number(
                chat.unread_count || 0
              );

              return (

                <div
                  key={`conversation-${chat.type}-${chat.id ?? chat.conversationId ?? chat.user_id}`}
                  onClick={() =>
                    handleSelectChat(chat)
                  }
                  className={`p-3 flex items-start gap-3 cursor-pointer transition-colors ${
                    selectedChat?.id === chat.id
                      ? "bg-emerald-50/60"
                      : "hover:bg-slate-50"
                  }`}
                >


                  {/* AVATAR */}

                  <div
                    className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-xs shrink-0 ${
                      chat.avatar_bg ||
                      chat.avatarBg ||
                      "bg-emerald-100 text-emerald-600"
                    }`}
                  >

                    {chat.type === "group" ? (

                      <Users className="w-4 h-4" />

                    ) : (

                      chat.initials ||
                      chat.name
                        ?.slice(0, 2)
                        .toUpperCase() ||
                      "U"

                    )}

                  </div>


                  {/* CONTENT */}

                  <div className="flex-1 min-w-0">

                    <div className="flex justify-between items-baseline mb-0.5">

                      <h4 className="text-xs font-semibold text-slate-800 truncate">

                        {chat.name ||
                          "Unknown"}

                      </h4>


                      {lastTime && (

                        <span className="text-[10px] text-slate-400 ml-2 shrink-0">

                          {lastTime}

                        </span>

                      )}

                    </div>


                    <div className="flex items-center justify-between gap-2">

                      <p
                        className={`text-xs truncate ${
                          unreadCount > 0
                            ? "font-semibold text-slate-700"
                            : "text-slate-500"
                        }`}
                      >

                        {lastMessage
                          ? lastMessage
                          : "No messages yet"}

                      </p>


                      {unreadCount > 0 && (

                        <span className="min-w-[18px] h-[18px] px-1 rounded-full bg-emerald-600 text-white text-[9px] font-bold flex items-center justify-center shrink-0">

                          {unreadCount > 99
                            ? "99+"
                            : unreadCount}

                        </span>

                      )}

                    </div>

                  </div>

                </div>

              );

            })

          )}

        </div>

      </aside>


      {/* ==================================================
          CHAT SCREEN
      ================================================== */}

      <section
        className={`flex-1 min-w-0 min-h-0 flex flex-col bg-[#efeae2] ${
          !showMobileChat
            ? "hidden md:flex"
            : "flex"
        }`}
      >

        {selectedChat ? (

          <>


            {/* ==================================================
                CHAT HEADER
            ================================================== */}

            <div className="h-14 bg-white border-b border-slate-200 px-4 sm:px-6 flex items-center justify-between shrink-0">

              <div className="flex items-center gap-2 sm:gap-3">

                <button
                  type="button"
                  onClick={() =>
                    setShowMobileChat(false)
                  }
                  className="md:hidden p-1 text-slate-500"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>


                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs ${
                    selectedChat.avatar_bg ||
                    selectedChat.avatarBg ||
                    "bg-emerald-100 text-emerald-600"
                  }`}
                >

                  {selectedChat.type ===
                  "group" ? (

                    <Users className="w-4 h-4" />

                  ) : (

                    selectedChat.initials ||
                    selectedChat.name
                      ?.slice(0, 2)
                      .toUpperCase() ||
                    "U"

                  )}

                </div>


                <div>

                  <h3 className="text-xs sm:text-sm font-semibold text-slate-800 flex items-center gap-2">

                    {selectedChat.name}

                    {selectedChat.type ===
                      "group" && (

                      <span className="text-[10px] bg-emerald-50 text-emerald-600 px-1.5 py-0.5 rounded font-normal">
                        Group
                      </span>

                    )}

                  </h3>


                  <p className="text-[10px] text-slate-400">

                    {selectedChat.type ===
                    "group"
                      ? `${
                          selectedChat.members
                            ?.length || 0
                        } Members`
                      : selectedChat.email ||
                        selectedChat.phone ||
                        "Direct Chat"}

                  </p>

                </div>

              </div>


              {/* HEADER ACTIONS */}

              <div className="flex items-center gap-2">

                {selectedChat.type ===
                  "group" && (

                  <div className="flex items-center gap-1.5">

                    <button
                      type="button"
                      onClick={() => {
                        setNewMemberName("");
                        setNewMemberPhone("");
                        setIsAddMemberModalOpen(
                          true
                        );
                      }}
                      className="flex items-center gap-1 bg-emerald-600 hover:bg-emerald-700 text-white px-2.5 py-1 rounded-lg text-xs font-medium"
                    >

                      <UserPlus className="w-3.5 h-3.5" />

                      <span className="hidden sm:inline">
                        Add Member
                      </span>

                    </button>


                    <button
                      type="button"
                      onClick={() =>
                        setIsGroupInfoOpen(
                          true
                        )
                      }
                      className="flex items-center gap-1 bg-slate-100 hover:bg-slate-200 text-slate-700 px-2.5 py-1 rounded-lg text-xs font-medium"
                    >

                      <Info className="w-3.5 h-3.5 text-slate-500" />

                      <span className="hidden sm:inline">
                        Members
                      </span>

                      ({selectedChat.members
                        ?.length || 0})

                    </button>

                  </div>

                )}


                <Search className="w-4 h-4 cursor-pointer text-slate-400 hover:text-slate-600 ml-2" />

                <Star className="w-4 h-4 cursor-pointer text-slate-400 hover:text-amber-500" />

                <MoreVertical className="w-4 h-4 cursor-pointer text-slate-400 hover:text-slate-600" />

              </div>

            </div>


            {/* ==================================================
                MESSAGES
            ================================================== */}

            <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden bg-[#efeae2] px-3 sm:px-5 py-4">

              {loadingMessages ? (

                <div className="flex justify-center items-center h-full text-xs text-slate-400 gap-2">

                  <Loader2 className="w-4 h-4 animate-spin" />

                  Loading messages...

                </div>

              ) : selectedChat.messages?.length >
                0 ? (

                <div className="space-y-1 min-h-full">

                  {selectedChat.messages.map(
                    (msg, index) => {

                      const isMe =
                        msg.sender ===
                        "me";

                      const isSystem =
                        msg.sender ===
                        "system";

                      const previousMessage =
                        selectedChat
                          .messages[
                          index - 1
                        ];

                      const showDate =
                        !previousMessage ||
                        !isSameMessageDate(
                          previousMessage.created_at,
                          msg.created_at
                        );


                      {/* SYSTEM */}

                      if (isSystem) {

                        return (
                          <React.Fragment
                            key={
                              msg.id ||
                              `system-${index}`
                            }
                          >

                            {showDate &&
                              msg.created_at && (

                              <div className="flex items-center justify-center py-3">

                                <div className="flex items-center gap-3 w-full max-w-xl">

                                  <div className="h-px bg-slate-300 flex-1" />

                                  <span className="text-[10px] text-slate-500 font-medium whitespace-nowrap bg-white/60 px-3 py-1 rounded-full">

                                    {formatMessageDate(
                                      msg.created_at
                                    )}

                                  </span>

                                  <div className="h-px bg-slate-300 flex-1" />

                                </div>

                              </div>

                            )}


                            <div className="flex justify-center py-2">

                              <span className="text-[10px] bg-white/70 text-slate-500 px-3 py-1 rounded-full shadow-sm">

                                {msg.text}

                              </span>

                            </div>

                          </React.Fragment>
                        );

                      }


                      return (

                        <React.Fragment
                          key={
                            msg.id ||
                            `message-${index}`
                          }
                        >


                          {/* DATE */}

                          {showDate &&
                            msg.created_at && (

                            <div className="flex items-center justify-center py-3">

                              <span className="text-[10px] bg-white/80 text-slate-500 px-3 py-1 rounded-full shadow-sm">

                                {formatMessageDate(
                                  msg.created_at
                                )}

                              </span>

                            </div>

                          )}


                          {/* ==================================================
                              INCOMING
                          ================================================== */}

                          {!isMe ? (

                            <div className="flex items-end gap-2 mb-3">

                              <div
                                className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-[9px] shrink-0 ${
                                  selectedChat.avatar_bg ||
                                  selectedChat.avatarBg ||
                                  "bg-emerald-100 text-emerald-600"
                                }`}
                              >

                                {selectedChat.initials ||
                                  selectedChat.name
                                    ?.slice(
                                      0,
                                      2
                                    )
                                    .toUpperCase() ||
                                  "U"}

                              </div>


                              <div className="flex flex-col items-start max-w-[78%] sm:max-w-md">


                                {/* GROUP SENDER */}

                                {selectedChat.type ===
                                  "group" && (

                                  <p className="text-[10px] font-semibold text-emerald-600 mb-1 ml-1">

                                    {msg.senderName ||
                                      selectedChat.name}

                                  </p>

                                )}


                                {/* BUBBLE */}

                                <div className="bg-white rounded-lg rounded-bl-none px-3 py-2 shadow-sm">

                                  {msg.text && (

                                    <p className="text-[11px] sm:text-xs text-slate-700 leading-relaxed whitespace-pre-wrap break-words">

                                      {msg.text}

                                    </p>

                                  )}


                                  {/* IMAGE */}

                                  {msg.type ===
                                    "image" &&
                                    msg.fileUrl && (

                                    <div
                                      className={
                                        msg.text
                                          ? "mt-2"
                                          : ""
                                      }
                                    >

                                      <div className="rounded-lg overflow-hidden bg-slate-50">

                                        <img
                                          src={
                                            msg.fileUrl
                                          }
                                          alt={
                                            msg.fileName ||
                                            "Attached image"
                                          }
                                          className="max-w-[280px] max-h-64 w-full object-cover"
                                        />

                                      </div>


                                      {msg.fileName && (

                                        <p className="text-[9px] text-slate-400 mt-1">

                                          {
                                            msg.fileName
                                          }

                                        </p>

                                      )}

                                    </div>

                                  )}


                                  {/* FILE */}

                                  {msg.type ===
                                    "file" && (

                                    <div
                                      className={
                                        msg.text
                                          ? "mt-2"
                                          : ""
                                      }
                                    >

                                      <div className="w-[220px] sm:w-[250px] bg-slate-50 border border-slate-200 rounded-lg p-2 flex items-center gap-2">

                                        <div className="w-9 h-9 rounded-md bg-blue-50 flex items-center justify-center shrink-0">

                                          <FileText className="w-5 h-5 text-blue-500" />

                                        </div>


                                        <div className="flex-1 min-w-0">

                                          <p className="text-[10px] font-semibold text-slate-700 truncate">

                                            {msg.fileName ||
                                              "Attached file"}

                                          </p>

                                          <p className="text-[9px] text-slate-400 mt-0.5">

                                            {msg.fileSize ||
                                              "File"}

                                            {" • "}

                                            {msg.fileName
                                              ?.split(
                                                "."
                                              )
                                              .pop()
                                              ?.toUpperCase() ||
                                              "FILE"}

                                          </p>

                                        </div>


                                        {msg.fileUrl && (

                                          <a
                                            href={
                                              msg.fileUrl
                                            }
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            download={
                                              msg.fileName
                                            }
                                            className="w-7 h-7 rounded-md flex items-center justify-center hover:bg-slate-200 text-slate-500 shrink-0"
                                          >

                                            <Download className="w-4 h-4" />

                                          </a>

                                        )}

                                      </div>

                                    </div>

                                  )}

                                </div>


                                <span className="text-[9px] text-slate-400 mt-1 ml-1">

                                  {msg.time}

                                </span>

                              </div>

                            </div>

                          ) : (


                            /* ==================================================
                               OUTGOING
                            ================================================== */

                            <div className="flex justify-end items-end mb-3">

                              <div className="flex flex-col items-end max-w-[78%] sm:max-w-md">

                                <div className="bg-[#d9fdd3] text-slate-800 rounded-lg rounded-br-none px-3 py-2 shadow-sm">

                                  {msg.text && (

                                    <p className="text-[11px] sm:text-xs leading-relaxed whitespace-pre-wrap break-words">

                                      {msg.text}

                                    </p>

                                  )}


                                  {/* IMAGE */}

                                  {msg.type ===
                                    "image" &&
                                    msg.fileUrl && (

                                    <div
                                      className={
                                        msg.text
                                          ? "mt-2"
                                          : ""
                                      }
                                    >

                                      <div className="rounded-lg overflow-hidden">

                                        <img
                                          src={
                                            msg.fileUrl
                                          }
                                          alt={
                                            msg.fileName ||
                                            "Attached image"
                                          }
                                          className="max-w-[280px] max-h-64 w-full object-cover"
                                        />

                                      </div>


                                      {msg.fileName && (

                                        <p className="text-[9px] text-slate-500 mt-1">

                                          {
                                            msg.fileName
                                          }

                                        </p>

                                      )}

                                    </div>

                                  )}


                                  {/* FILE */}

                                  {msg.type ===
                                    "file" && (

                                    <div
                                      className={
                                        msg.text
                                          ? "mt-2"
                                          : ""
                                      }
                                    >

                                      <div className="w-[220px] sm:w-[250px] bg-emerald-600/80 border border-emerald-500/50 rounded-lg p-2 flex items-center gap-2">

                                        <div className="w-9 h-9 rounded-md bg-white/30 flex items-center justify-center shrink-0">

                                          <FileText className="w-5 h-5 text-white" />

                                        </div>


                                        <div className="flex-1 min-w-0">

                                          <p className="text-[10px] font-semibold text-white truncate">

                                            {msg.fileName ||
                                              "Attached file"}

                                          </p>

                                          <p className="text-[9px] text-emerald-50 mt-0.5">

                                            {msg.fileSize ||
                                              "File"}

                                            {" • "}

                                            {msg.fileName
                                              ?.split(
                                                "."
                                              )
                                              .pop()
                                              ?.toUpperCase() ||
                                              "FILE"}

                                          </p>

                                        </div>


                                        {msg.fileUrl && (

                                          <a
                                            href={
                                              msg.fileUrl
                                            }
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            download={
                                              msg.fileName
                                            }
                                            className="w-7 h-7 rounded-md flex items-center justify-center hover:bg-emerald-500 text-white shrink-0"
                                          >

                                            <Download className="w-4 h-4" />

                                          </a>

                                        )}

                                      </div>

                                    </div>

                                  )}

                                </div>


                                <div className="flex items-center gap-1 mt-1 mr-1">

                                  <span className="text-[9px] text-slate-400">
                                    {msg.time}
                                  </span>

                                  <CheckCheck className="w-3.5 h-3.5 text-[#53bdeb]" />

                                </div>

                              </div>

                            </div>

                          )}

                        </React.Fragment>

                      );

                    }
                  )}


                  <div ref={messagesEndRef} />

                </div>

              ) : (

                <div className="flex items-center justify-center h-full text-xs text-slate-400">

                  No messages yet. Start the conversation.

                </div>

              )}

            </div>


            {/* ==================================================
                MESSAGE INPUT
            ================================================== */}

            <div className="p-3 sm:p-4 bg-[#f0f2f5] border-t border-slate-200 shrink-0">

              <form
                onSubmit={handleSendMessage}
                className="bg-white border border-slate-200 rounded-xl p-2 focus-within:border-emerald-500 shadow-sm"
              >
<div className="flex items-center gap-2">

  <textarea
    placeholder="Type a message..."
    value={inputMessage}
    onChange={(e) => {
      setInputMessage(e.target.value);
    }}
    onKeyDown={(e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();

        if (
          !sendingMessage &&
          inputMessage.trim()
        ) {
          handleSendMessage(e);
        }
      }

      // Shift + Enter = normal new line
    }}
    disabled={sendingMessage}
    rows={1}
    className="flex-1 min-w-0 bg-transparent text-xs px-2 py-2 outline-none text-slate-700 resize-none max-h-24 overflow-y-auto"
  />

  <button
    type="submit"
    disabled={
      sendingMessage ||
      !inputMessage.trim()
    }
    className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed text-white w-8 h-8 rounded-full flex items-center justify-center shrink-0"
  >
    {sendingMessage ? (
      <Loader2 className="w-3.5 h-3.5 animate-spin" />
    ) : (
      <Send className="w-3.5 h-3.5" />
    )}
  </button>

</div>

                <div className="flex items-center justify-between mt-1 pt-1 border-t border-slate-100">

                  <div className="flex items-center gap-3 text-slate-400">

                    <button
                      type="button"
                      className="hover:text-slate-600"
                    >
                      <Smile className="w-4 h-4" />
                    </button>


                    <button
                      type="button"
                      disabled={sendingMessage}
                      onClick={() =>
                        fileInputRef.current?.click()
                      }
                      className="hover:text-slate-600 disabled:opacity-50"
                    >
                      <Paperclip className="w-4 h-4" />
                    </button>


                    <button
                      type="button"
                      disabled={sendingMessage}
                      onClick={() =>
                        fileInputRef.current?.click()
                      }
                      className="hover:text-slate-600 disabled:opacity-50"
                    >
                      <ImageIcon className="w-4 h-4" />
                    </button>

                  </div>


                  <span className="text-[9px] text-slate-400 hidden sm:block">
                    Press Enter to send
                  </span>

                </div>

              </form>

            </div>

          </>

        ) : (

          <div className="flex-1 flex items-center justify-center text-slate-400 text-xs">

            Select a conversation to start chatting

          </div>

        )}

      </section>

    </div>


    {/* ==================================================
        ADD MEMBER MODAL
    ================================================== */}

    {isAddMemberModalOpen &&
      selectedChat?.type === "group" && (

      <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">

        <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden">

          <div className="flex items-center justify-between p-4 border-b border-slate-100">

            <h3 className="font-semibold text-sm text-slate-800 flex items-center gap-2">

              <UserPlus className="w-4 h-4 text-emerald-600" />

              Add Member to "{selectedChat.name}"

            </h3>


            <button
              type="button"
              onClick={() => {
                setIsAddMemberModalOpen(
                  false
                );
                setNewMemberName("");
                setNewMemberPhone("");
              }}
              className="text-slate-400 hover:text-slate-600"
            >
              <X className="w-4 h-4" />
            </button>

          </div>


          <form
            onSubmit={
              handleAddMemberToExistingGroup
            }
            className="p-4 space-y-4"
          >

            <div>

              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Member Name
              </label>

              <input
                type="text"
                required
                placeholder="Enter Name"
                value={newMemberName}
                onChange={(e) =>
                  setNewMemberName(
                    e.target.value
                  )
                }
                className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs focus:outline-none focus:border-emerald-500"
              />

            </div>


            <div>

              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Phone Number
              </label>

              <input
                type="text"
                required
                placeholder="+92 300 0000000"
                value={newMemberPhone}
                onChange={(e) =>
                  setNewMemberPhone(
                    e.target.value
                  )
                }
                className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs focus:outline-none focus:border-emerald-500"
              />

            </div>


            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">

              <button
                type="button"
                onClick={() => {
                  setIsAddMemberModalOpen(
                    false
                  );
                  setNewMemberName("");
                  setNewMemberPhone("");
                }}
                className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded-lg"
              >
                Cancel
              </button>


              <button
                type="submit"
                disabled={sendingMessage}
                className="px-4 py-1.5 text-xs bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-lg font-medium"
              >

                {sendingMessage
                  ? "Adding..."
                  : "Add Member"}

              </button>

            </div>

          </form>

        </div>

      </div>

    )}


    {/* ==================================================
        CREATE GROUP MODAL
    ================================================== */}

    {isGroupModalOpen && (

      <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">

        <div className="bg-white rounded-xl shadow-xl w-full max-w-lg overflow-hidden max-h-[90vh] flex flex-col">


          {/* HEADER */}

          <div className="flex items-center justify-between p-4 border-b border-slate-100 shrink-0">

            <h3 className="font-semibold text-sm text-slate-800 flex items-center gap-2">

              <Users className="w-4 h-4 text-emerald-600" />

              Create New Group

            </h3>


            <button
              type="button"
              onClick={() =>
                setIsGroupModalOpen(false)
              }
              className="text-slate-400 hover:text-slate-600"
            >
              <X className="w-4 h-4" />
            </button>

          </div>


          <form
            onSubmit={handleCreateGroup}
            className="p-4 space-y-4 overflow-y-auto flex-1"
          >


            {/* GROUP NAME */}

            <div>

              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Group Name
              </label>

              <input
                type="text"
                required
                placeholder="Group Name..."
                value={groupName}
                onChange={(e) =>
                  setGroupName(
                    e.target.value
                  )
                }
                className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs focus:outline-none focus:border-emerald-500"
              />

            </div>


            {/* CUSTOM MEMBER */}

            <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 space-y-2">

              <label className="block text-xs font-semibold text-slate-700 flex items-center gap-1">

                <UserPlus className="w-3.5 h-3.5 text-blue-500" />

                Add Member by Phone

              </label>


              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">

                <input
                  type="text"
                  placeholder="Member Name"
                  value={customName}
                  onChange={(e) =>
                    setCustomName(
                      e.target.value
                    )
                  }
                  className="px-2.5 py-1 border border-slate-200 rounded text-xs bg-white focus:outline-none focus:border-emerald-500"
                />


                <input
                  type="text"
                  placeholder="Phone Number"
                  value={customPhone}
                  onChange={(e) =>
                    setCustomPhone(
                      e.target.value
                    )
                  }
                  className="px-2.5 py-1 border border-slate-200 rounded text-xs bg-white focus:outline-none focus:border-emerald-500"
                />

              </div>


              <button
                type="button"
                onClick={
                  handleAddCustomMember
                }
                className="w-full mt-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-600 font-medium py-1 rounded text-xs flex items-center justify-center gap-1"
              >

                <Plus className="w-3 h-3" />

                Add

              </button>

            </div>


            {/* CUSTOM MEMBERS */}

            {customMembersList.length >
              0 && (

              <div>

                <label className="block text-[11px] font-semibold text-slate-500 mb-1">

                  Added Members (
                  {
                    customMembersList.length
                  }
                  ):

                </label>


                <div className="flex flex-wrap gap-1.5">

                  {customMembersList.map(
                    (member) => (

                    <span
                      key={member.id}
                      className="bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] px-2 py-0.5 rounded-full flex items-center gap-1"
                    >

                      {member.name} (
                      {member.phone}
                      )


                      <button
                        type="button"
                        onClick={() =>
                          removeCustomMember(
                            member.id
                          )
                        }
                        className="hover:text-red-500"
                      >

                        <X className="w-3 h-3" />

                      </button>

                    </span>

                  ))}

                </div>

              </div>

            )}


            {/* EXISTING CONTACTS */}

            <div>

              <label className="block text-xs font-semibold text-slate-700 mb-1">

                Select Existing Contacts

              </label>


              <div className="max-h-36 overflow-y-auto border border-slate-200 rounded-lg divide-y divide-slate-100">

                {uniqueConversations.filter(
                  (contact) =>
                    contact.type ===
                    "direct"
                ).length === 0 ? (

                  <p className="p-3 text-xs text-slate-400 text-center">
                    No existing contacts found.
                  </p>

                ) : (

                  uniqueConversations
                    .filter(
                      (contact) =>
                        contact.type ===
                        "direct"
                    )
                    .map((contact) => {

                      const contactId =
                        contact.user_id ||
                        contact.other_user_id ||
                        contact.id;

                      const isChecked =
                        selectedMembers.some(
                          (member) =>
                            Number(
                              member.user_id ||
                              member.id
                            ) ===
                            Number(contactId)
                        );


                      return (

                        <label
                          key={`group-contact-${contactId}`}
                          className="flex items-center justify-between p-2 hover:bg-slate-50 cursor-pointer"
                        >

                          <div className="flex items-center gap-2">

                            <div
                              className={`w-6 h-6 rounded-full flex items-center justify-center font-bold text-[10px] ${
                                contact.avatar_bg ||
                                contact.avatarBg ||
                                "bg-emerald-100 text-emerald-600"
                              }`}
                            >

                              {contact.initials ||
                                contact.name
                                  ?.slice(
                                    0,
                                    2
                                  )
                                  .toUpperCase() ||
                                "U"}

                            </div>


                            <div>

                              <p className="text-xs text-slate-700 font-medium">

                                {
                                  contact.name
                                }

                              </p>


                              <p className="text-[9px] text-slate-400">

                                {contact.phone ||
                                  contact.email ||
                                  ""}

                              </p>

                            </div>

                          </div>


                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() =>
                              handleMemberToggle(
                                contact
                              )
                            }
                            className="rounded text-emerald-600 focus:ring-emerald-500 h-3.5 w-3.5"
                          />

                        </label>

                      );

                    })

                )}

              </div>

            </div>


            {/* FOOTER */}

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">

              <button
                type="button"
                onClick={() =>
                  setIsGroupModalOpen(false)
                }
                className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded-lg font-medium"
              >
                Cancel
              </button>


              <button
                type="submit"
                disabled={sendingMessage}
                className="px-4 py-1.5 text-xs bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-lg font-medium"
              >

                {sendingMessage
                  ? "Creating..."
                  : "Create Group"}

              </button>

            </div>

          </form>

        </div>

      </div>

    )}


    {/* ==================================================
        GROUP MEMBERS MODAL
    ================================================== */}

    {isGroupInfoOpen &&
      selectedChat?.type ===
        "group" && (

      <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">

        <div className="bg-white rounded-xl shadow-xl w-full max-w-sm overflow-hidden flex flex-col">


          {/* HEADER */}

          <div className="flex items-center justify-between p-4 border-b border-slate-100">

            <div className="flex items-center gap-2">

              <Users className="w-4 h-4 text-emerald-600" />

              <h3 className="font-semibold text-sm text-slate-800">

                {selectedChat.name} Members

              </h3>

            </div>


            <button
              type="button"
              onClick={() =>
                setIsGroupInfoOpen(false)
              }
              className="text-slate-400 hover:text-slate-600"
            >
              <X className="w-4 h-4" />
            </button>

          </div>


          {/* MEMBERS */}

          <div className="p-4 max-h-80 overflow-y-auto space-y-2">

            <p className="text-xs text-slate-400 font-medium mb-2">

              Total Members:{" "}

              {selectedChat.members
                ?.length || 0}

            </p>


            {selectedChat.members?.length >
            0 ? (

              selectedChat.members.map(
                (member, index) => (

                  <div
                    key={`member-${
                      member.user_id ||
                      member.id ||
                      "unknown"
                    }-${index}`}
                    className="flex items-center justify-between p-2 rounded-lg bg-slate-50 border border-slate-100"
                  >

                    <div className="flex items-center gap-2 min-w-0">

                      <div
                        className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs shrink-0 ${
                          member.avatarBg ||
                          member.avatar_bg ||
                          "bg-slate-200 text-slate-600"
                        }`}
                      >

                        {member.initials ||
                          member.name
                            ?.slice(
                              0,
                              2
                            )
                            .toUpperCase() ||
                          "U"}

                      </div>


                      <div className="min-w-0">

                        <p className="text-xs font-semibold text-slate-700 truncate">

                          {member.name ||
                            "Unknown"}

                        </p>


                        <p className="text-[10px] text-slate-400 flex items-center gap-1">

                          <Phone className="w-2.5 h-2.5" />

                          {member.phone ||
                            member.email ||
                            "No Phone"}

                        </p>

                      </div>

                    </div>


                    {member.role && (

                      <span className="text-[9px] bg-white border border-slate-200 px-1.5 py-0.5 rounded text-slate-500">

                        {member.role}

                      </span>

                    )}

                  </div>

                )
              )

            ) : (

              <p className="text-xs text-slate-400 text-center py-4">

                No members in this group.

              </p>

            )}

          </div>


          {/* FOOTER */}

          <div className="p-3 border-t border-slate-100 flex justify-end">

            <button
              type="button"
              onClick={() =>
                setIsGroupInfoOpen(false)
              }
              className="px-3 py-1 text-xs bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300 font-medium"
            >
              Close
            </button>

          </div>

        </div>

      </div>

    )}


    {/* ==================================================
        SIDEBAR
    ================================================== */}

    <Sidebar
      sidebarOpen={sidebarOpen}
      setSidebarOpen={setSidebarOpen}
      setShowLogoutModal={
        setShowLogoutModal
      }
    />


    {/* ==================================================
        LOGOUT MODAL
    ================================================== */}

    <LogoutModal
      show={showLogoutModal}
      loggingOut={loggingOut}
      onCancel={() =>
        setShowLogoutModal(false)
      }
      onConfirm={
        handleConfirmLogout
      }
    />

  </div>
);
}

