const bcrypt = require("bcryptjs");
const { UserInputError, AuthenticationError } = require("apollo-server");
const jwt = require("jsonwebtoken");
const { Op } = require("sequelize");
const { JWT_SECRET } = require("../../config/env.json");
const { Message, User } = require("../../models");

module.exports = {
  Query: {
    getUsers: async (_, __, { user }) => {
      //token 헤더 작업
      try {
        // context파라미터에 입력하면 미들웨어가 적용되고
        // 미들웨어의 user를 디코딩해서 뽑아온다<div className=""></div>
        if (!user) throw new AuthenticationError("인증오류");

        // 미들웨어로 적용시킴
        // if (context.req && context.req.headers.authorization) {
        //   const token = context.req.headers.authorization.split("Bearer ")[1];
        //   jwt.verify(token, JWT_SECRET, (err, decodedToken) => {
        //     if (err) {
        //       throw new AuthenticationError("Unauthenticated");
        //     }
        //     user = decodedToken;
        //   });
        // }

        //자기 계정 뺴고 검색
        let users = await User.findAll({
          attributes: ["username", "imageUrl", "createdAt"],
          where: { username: { [Op.ne]: user.username } },
        });

        //각 사람들의 최신 메시지를 가져오고 이때 관계쿼리가 아닌
        //자바스크립트 문법으로 가져옴
        const allUsersMessage = await Message.findAll({
          where: {
            [Op.or]: [{ from: user.username }, { to: user.username }],
          },
          order: [["createdAt", "DESC"]],
        });

        users = users.map((otherUser) => {
          //find함수로 주어진 배열의 첫번째 요소값을 가져온다
          const latestMessage = allUsersMessage.find(
            (m) => m.from === otherUser.username || m.to === otherUser.username
          );
          console.log(latestMessage);
          otherUser.latestMessage = latestMessage;
          return otherUser;
        });
        return users;
      } catch (err) {
        console.log(err);
        throw err;
      }
    },
    login: async (_, args) => {
      const { username, password } = args;
      let errors = {};
      try {
        if (username.trim() === "") errors.username = "유저명 입력해주세요";
        if (password === "") errors.password = "패스워드를 입력해주세요";

        if (Object.keys(errors).length > 0) {
          throw new UserInputError("bad input", { errors });
        }

        const user = await User.findOne({
          where: { username },
        });

        if (!user) {
          errors.username = "유저를 찾을 수 없습니다.";
          throw new UserInputError("유저를없음", { errors });
        }

        const correctPassword = await bcrypt.compare(password, user.password);

        if (!correctPassword) {
          errors.password = "패스워드가 정확하지 않아요";
          throw new UserInputError("패스워드 오류", { errors });
        }

        const token = jwt.sign({ username }, JWT_SECRET, {
          expiresIn: 60 * 60,
        });

        //createdAt 넣을려고 이작업했음... 잘모름
        return {
          ...user.toJSON(),
          createdAt: user.createdAt.toISOString(),
          token,
        };
      } catch (err) {
        console.log(err);
        throw err;
      }
    },
  },
  Mutation: {
    register: async (_, args) => {
      //password 변하므로 let으로 설정
      let { username, email, password, confirmPassword } = args;
      let errors = {};

      try {
        if (email.trim() === "") errors.email = "이메일 입력해주세요";
        if (username.trim() === "") errors.username = "유저명 입력해주세요";
        if (password.trim() === "") errors.password = "패스워드 입력해주세요";
        if (confirmPassword.trim() === "")
          errors.confirmPassword = "패스워드확인 입력해주세요";

        if (password !== confirmPassword)
          errors.confirmPassword = "패스워드들이 서로 맞지 않아요";

        //유저명 이메일 이미 존재하는지 확인
        // const userByUsername = await User.findOne({ where: { username } });
        // const userEmail = await User.findOne({ where: { email } });
        // if (userByUsername) errors.username = "이미 있는 유저명입니다.";
        // if (userEmail) errors.email = "이미 있는 이메일입니다.";

        if (Object.keys(errors).length > 0) {
          throw errors;
        }

        //비번 암호화
        password = await bcrypt.hash(password, 6);

        const user = await User.create({
          username,
          email,
          password,
        });
        return user;
      } catch (err) {
        console.log(err.errors);
        if (err.name === "SequelizeUniqueConstraintError") {
          err.errors.forEach(
            (e) => (errors[e.path] = `${e.path} 은 이미있어요`)
          );
        } else if (err.name === "SequelizeValidationError") {
          err.errors.forEach((e) => (errors[e.path] = e.message));
        }
        throw new UserInputError("잘못된 입력", { errors });
      }
    },
  },
};
