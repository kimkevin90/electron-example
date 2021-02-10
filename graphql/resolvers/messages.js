const { UserInputError, AuthenticationError } = require("apollo-server");
const { Op } = require("sequelize");
const { User, Message } = require("../../models");

module.exports = {
  Query: {
    getMessages: async (parent, { from }, { user }) => {
      try {
        if (!user) throw new AuthenticationError("인증오류");

        const otherUser = await User.findOne({
          where: { username: from },
        });
        if (!otherUser) throw new UserInputError("유저를 찾지 못했어요");

        //from 이랑 to랑 동시에 찾기위해서??
        const usernames = [user.username, otherUser.username];

        const messages = await Message.findAll({
          where: {
            from: { [Op.in]: usernames },
            to: { [Op.in]: usernames },
          },
          order: [["createdAt", "DESC"]],
        });
        return messages;
      } catch (err) {
        console.log(err);
        throw err;
      }
    },
  },
  Mutation: {
    sendMessage: async (parent, { to, content }, { user }) => {
      try {
        if (!user) throw new AuthenticationError("인증오류");

        const recipient = await User.findOne({ where: { username: to } });

        if (!recipient) {
          throw new UserInputError("유저를 찾지 못했습니다.");
        } else if (recipient.username === user.username) {
          throw new UserInputError("자기 자신한테는 메시지 못보냄");
        }
        if (content.trim() === "") {
          throw new UserInputError("메시지가 없습니다");
        }

        const message = await Message.create({
          from: user.username,
          to,
          content,
        });
        return message;
      } catch (err) {
        console.log(err);
        throw err;
      }
    },
  },
};
